import { storageRows } from "pages/system/components/SystemStorage";

describe("storageRows", () => {
  it("sorts apps by disk use and computes shares", () => {
    const rows = storageRows([
      { name: "a", volumes: [{ size: 100 }] },
      { name: "b", volumes: [{ size: 300 }, { size: 100 }] },
      { name: "c", volumes: [] },
    ]);
    expect(rows.map(r => r.pkg.name)).toEqual(["b", "a"]);
    expect(rows[0]).toMatchObject({ size: 400, share: 0.8 });
  });

  it("leaves out apps using no disk space and returns [] when there are none", () => {
    expect(storageRows([{ name: "empty", volumes: [] }])).toEqual([]);
    expect(storageRows([])).toEqual([]);
    expect(storageRows()).toEqual([]);
  });
});
