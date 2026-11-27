import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { pickTemperatures, useTemperatures, formatCelsius, HOT_HINT, POLL_MS } from "pages/dashboard/temperatures";
import ResourcesStrip from "pages/dashboard/components/ResourcesStrip";
import { canGetTemperatures, TEMPERATURES_SINCE } from "health/clients";
import { mockTemperatures } from "../../../mockState";

// ticket-0932's box (AMD Ryzen, two NVMe drives), as getTemperatures returns it
const kris = (cpu, disk1, disk2) => [
  { chip: "nvme", device: "0000:06:00.0", label: "Composite", celsius: disk2, high: 89.9, crit: 93.9 },
  { chip: "nvme", device: "0000:06:00.0", label: "Sensor 1", celsius: 57.9, high: null, crit: null },
  { chip: "acpitz", device: null, label: null, celsius: 27.8, high: null, crit: 110 },
  { chip: "k10temp", device: "0000:00:18.3", label: "Tctl", celsius: cpu, high: null, crit: null },
  { chip: "nvme", device: "0000:01:00.0", label: "Composite", celsius: disk1, high: 117.9, crit: 149.9 },
  { chip: "iwlwifi_1", device: null, label: null, celsius: 52, high: null, crit: null },
];

describe("pickTemperatures", () => {
  it("shows the processor, then each disk in device order; skips acpitz and the wifi card", () => {
    expect(pickTemperatures(kris(68.5, 47.9, 41.9))).toEqual([
      { id: "processor", label: "Processor", celsius: 68.5, tone: "ok" },
      { id: "disk-1", label: "Disk 1", celsius: 47.9, tone: "ok" },
      { id: "disk-2", label: "Disk 2", celsius: 41.9, tone: "ok" },
    ]);
  });

  it("processor: warning from 85 °C, critical from 95 °C (ticket-0932: 90 °C one minute after boot)", () => {
    const tone = c => pickTemperatures(kris(c, 40, 40))[0].tone;
    expect(tone(84.9)).toBe("ok");
    expect(tone(85)).toBe("warn");
    expect(tone(90.1)).toBe("warn");
    expect(tone(95)).toBe("crit");
  });

  it("a disk uses its own high/critical marks when they are sane", () => {
    const disk2 = c => pickTemperatures(kris(50, 40, c))[2].tone;
    expect(disk2(75)).toBe("ok"); // below its own 89.9 °C mark
    expect(disk2(89.9)).toBe("warn");
    expect(disk2(93.9)).toBe("crit");
  });

  it("a disk with a nonsense high mark (117.9 °C) falls back to 70 / 80 °C", () => {
    const disk1 = c => pickTemperatures(kris(50, c, 40))[1].tone;
    expect(disk1(69.9)).toBe("ok");
    expect(disk1(70)).toBe("warn");
    expect(disk1(80)).toBe("crit");
  });

  it('one disk is just "Disk"; Intel uses the package sensor', () => {
    const rows = pickTemperatures([
      { chip: "coretemp", label: "Core 0", celsius: 60 },
      { chip: "coretemp", label: "Package id 0", celsius: 58 },
      { chip: "nvme", device: "nvme0", label: "Composite", celsius: 39 },
    ]);
    expect(rows.map(r => [r.label, r.celsius])).toEqual([
      ["Processor", 58],
      ["Disk", 39],
    ]);
  });

  it("Intel without a package sensor: the hottest core", () => {
    const rows = pickTemperatures([
      { chip: "coretemp", label: "Core 0", celsius: 60 },
      { chip: "coretemp", label: "Core 1", celsius: 66 },
    ]);
    expect(rows).toEqual([{ id: "processor", label: "Processor", celsius: 66, tone: "ok" }]);
  });

  it("AMD: Tdie (the real die temperature) wins over Tctl", () => {
    const rows = pickTemperatures([
      { chip: "k10temp", label: "Tctl", celsius: 80 },
      { chip: "k10temp", label: "Tdie", celsius: 60 },
    ]);
    expect(rows[0].celsius).toBe(60);
  });

  it("memory only when it has a sensor; several sticks show the hottest", () => {
    expect(pickTemperatures(kris(60, 40, 40)).some(r => r.id === "memory")).toBe(false);
    const rows = pickTemperatures([
      { chip: "spd5118", device: "1-0050", label: null, celsius: 44 },
      { chip: "spd5118", device: "1-0051", label: null, celsius: 81 },
    ]);
    expect(rows).toEqual([{ id: "memory", label: "Memory", celsius: 81, tone: "warn" }]);
  });

  it("nothing known: no rows", () => {
    expect(pickTemperatures(null)).toEqual([]);
    expect(pickTemperatures([])).toEqual([]);
    expect(pickTemperatures([{ chip: "k10temp", label: "Tctl", celsius: null }])).toEqual([]);
  });

  it("mock data: normal and ?mock=hot", async () => {
    const normal = pickTemperatures((await mockTemperatures(null)).sensors);
    expect(normal.every(r => r.tone === "ok")).toBe(true);
    const hot = pickTemperatures((await mockTemperatures("hot")).sensors);
    expect(hot.map(r => r.tone)).toEqual(["warn", "ok", "warn"]);
  });
});

describe("ResourcesStrip temperatures", () => {
  it('shows each temperature in plain words ("Processor 69 °C")', () => {
    render(<ResourcesStrip stats={{ cpu: "6%", memory: "12%", disk: "2%" }} temperatures={pickTemperatures(kris(68.5, 47.9, 41.9))} />);
    const group = screen.getByRole("group", { name: "Temperature" });
    expect(group).toHaveTextContent("Processor");
    expect(group).toHaveTextContent("69 °C");
    expect(group).toHaveTextContent("Disk 1");
    expect(group).toHaveTextContent("48 °C");
    expect(group).toHaveTextContent("Disk 2");
    expect(group).toHaveTextContent("42 °C");
    expect(screen.queryByText(HOT_HINT)).not.toBeInTheDocument();
  });

  it("running hot: warning colour and the plain hint", () => {
    const { container } = render(<ResourcesStrip stats={{ cpu: "6%", memory: "12%", disk: "2%" }} temperatures={pickTemperatures(kris(90.1, 47.9, 41.9))} />);
    expect(screen.getByText(HOT_HINT)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Temperature" }).querySelector(".bg-warning")).toBeInTheDocument();
    expect(container.querySelectorAll(".bg-warning")).toHaveLength(1);
  });

  it("no temperatures (older DAPPMANAGER, or no sensors): nothing is shown", () => {
    render(<ResourcesStrip stats={{ cpu: "6%" }} temperatures={[]} />);
    expect(screen.queryByRole("group", { name: "Temperature" })).not.toBeInTheDocument();
    render(<ResourcesStrip stats={{ cpu: "6%" }} />);
    expect(screen.queryByText("Temperature")).not.toBeInTheDocument();
  });

  it("formats whole degrees", () => {
    expect(formatCelsius(68.5)).toBe("69 °C");
    expect(formatCelsius(41.9)).toBe("42 °C");
  });
});

describe("canGetTemperatures", () => {
  const core = version => [{ name: "dappmanager.dnp.dappnode.eth", version }];
  it(`DAPPMANAGER ${TEMPERATURES_SINCE} and newer only`, () => {
    expect(TEMPERATURES_SINCE).toBe("10.0.62");
    expect(canGetTemperatures(core("10.0.61"))).toBe(false);
    expect(canGetTemperatures(core("10.0.62"))).toBe(true);
    expect(canGetTemperatures(core("10.0.70"))).toBe(true);
    expect(canGetTemperatures([], "10.0.62")).toBe(true);
    expect(canGetTemperatures(null, null)).toBe(false);
  });
});

describe("useTemperatures", () => {
  afterEach(() => vi.useRealTimers());

  it("never calls an older core", () => {
    const fetch = vi.fn();
    const { result } = renderHook(() => useTemperatures(false, fetch));
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current).toBe(null);
  });

  it("reads at once, then every 30 s; a failed read keeps the last answer", async () => {
    vi.useFakeTimers();
    const sensors = kris(60, 40, 40);
    const fetch = vi.fn().mockResolvedValueOnce({ sensors }).mockRejectedValueOnce(Error("connection closed"));
    const { result } = renderHook(() => useTemperatures(true, fetch));
    await act(async () => {
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(result.current).toEqual(sensors));
    await act(async () => {
      vi.advanceTimersByTime(POLL_MS);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual(sensors);
  });

  it("an answer without sensors is an empty list", async () => {
    const fetch = vi.fn().mockResolvedValue({ sensors: undefined });
    const { result } = renderHook(() => useTemperatures(true, fetch));
    await waitFor(() => expect(result.current).toEqual([]));
  });
});
