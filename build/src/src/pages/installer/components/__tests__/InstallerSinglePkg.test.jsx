import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { InstallerInterface } from "pages/installer/components/InstallerSinglePkg";

const manifest = {
  name: "rotki.avado.dnp.dappnode.eth",
  title: "Rotki",
  version: "1.0.0",
  image: { size: 12345 },
  descriptionmd: "Some intro.\n\n1. First step\n2. Second step\n\n- a bullet\n- another bullet",
};

const baseProps = {
  id: "rotki.avado.dnp.dappnode.eth",
  dnp: { loading: false, manifest },
  progressLogs: {},
  install: () => {},
  clearUserSet: () => {},
  fetchPackageRequest: () => {},
  packages: [],
  history: { push: () => {} },
};

describe("InstallerInterface description markdown", () => {
  it("renders an ordered list with numbering (list-decimal), matching the bullets' list-disc", () => {
    const { container } = render(<InstallerInterface {...baseProps} />);
    expect(screen.getByText("Rotki")).toBeInTheDocument();

    // ReactMarkdown renders real <ol>/<ul> elements; the Tailwind styling is
    // applied via arbitrary-variant classes ([&_ol]:..., [&_ul]:...) on the
    // wrapping "prose-installer" div, so that's what has to carry them.
    const ol = container.querySelector("ol");
    expect(ol).toBeInTheDocument();
    const ul = container.querySelector("ul");
    expect(ul).toBeInTheDocument();

    const wrapper = container.querySelector(".prose-installer");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper.className).toMatch(/\[&_ol\]:list-decimal/);
    expect(wrapper.className).toMatch(/\[&_ol\]:pl-5/);
    expect(wrapper.className).toMatch(/\[&_ul\]:list-disc/);
  });
});

const mockConfirmSecond = vi.fn();
vi.mock("pages/installer/components/confirmSecondValidatorApp", () => ({
  default: (...args) => mockConfirmSecond(...args),
}));

describe("InstallerInterface: a second validator app on the same network", () => {
  const TEKU = "teku.avado.dnp.dappnode.eth";
  const tekuManifest = { name: TEKU, title: "Teku", version: "2.0.0", image: { size: 1 }, description: "Teku." };
  const nimbus = { name: "nimbus.avado.dnp.dappnode.eth", state: "exited", running: false, version: "1.0.0", manifest: { title: "Nimbus" } };
  const props = (manifest, packages) => ({
    ...baseProps,
    id: manifest.name,
    dnp: { loading: false, manifest },
    install: vi.fn(),
    packages,
  });

  beforeEach(() => mockConfirmSecond.mockClear());

  it("asks first when another app that can hold validator keys is installed for that network (stopped or not)", () => {
    const p = props(tekuManifest, [nimbus]);
    render(<InstallerInterface {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(p.install).not.toHaveBeenCalled();
    expect(mockConfirmSecond).toHaveBeenCalledTimes(1);
    const [args, onConfirm] = mockConfirmSecond.mock.calls[0];
    expect(args).toEqual({ app: { name: TEKU, manifest: tekuManifest }, network: "mainnet", others: [nimbus] });
    onConfirm();
    expect(p.install).toHaveBeenCalledWith(TEKU, {});
  });

  it("does not ask on an update", () => {
    const p = props(tekuManifest, [nimbus, { name: TEKU, version: "1.0.0", manifest: { title: "Teku" } }]);
    render(<InstallerInterface {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Update to 2.0.0" }));
    expect(mockConfirmSecond).not.toHaveBeenCalled();
    expect(p.install).toHaveBeenCalledWith(TEKU, {});
  });

  it("does not ask next to Prysm's beacon chain alone, on another network, or for other apps", () => {
    const cases = [
      [tekuManifest, [{ name: "prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth", version: "1.0.0" }]],
      [tekuManifest, [{ name: "teku-holesky.avado.dnp.dappnode.eth", version: "1.0.0" }]],
      [{ ...manifest, name: "eth2validator.avado.dnp.dappnode.eth", title: "Prysm" }, [{ name: "prysm-beacon-chain-mainnet.avado.dnp.dappnode.eth", version: "1.0.0" }]],
      [manifest, [nimbus, { name: TEKU, version: "1.0.0" }]],
    ];
    for (const [m, packages] of cases) {
      const p = props(m, packages);
      const { unmount } = render(<InstallerInterface {...p} />);
      fireEvent.click(screen.getByRole("button", { name: "Install" }));
      expect(p.install).toHaveBeenCalledWith(m.name, {});
      unmount();
    }
    expect(mockConfirmSecond).not.toHaveBeenCalled();
  });
});

describe("InstallerInterface: setup fields (manifest setupWizard)", () => {
  const TS = "tailscale.avado.dnp.dappnode.eth";
  const field = {
    id: "TS_AUTHKEY",
    target: { type: "environment", name: "TS_AUTHKEY", service: "tailscale" },
    title: "Tailscale auth key",
    description: "Make a reusable key in your [Tailscale settings](https://login.tailscale.com/admin/settings/keys) and paste it here.",
    secret: true
  };
  const tsManifest = (fields = [field]) => ({
    name: TS, title: "Tailscale", version: "0.1.0", image: { size: 1 }, description: "Tailscale.",
    setupWizard: { version: "2", fields }
  });
  const props = (manifest, packages = []) => ({
    ...baseProps,
    id: manifest.name,
    dnp: { loading: false, manifest },
    install: vi.fn(),
    updateUserSetEnvs: vi.fn(),
    packages,
  });

  it("shows a labelled, masked, optional input with one line of help and a real link", () => {
    render(<InstallerInterface {...props(tsManifest())} />);
    const input = screen.getByLabelText(/Tailscale auth key/);
    expect(input).toHaveAttribute("type", "password");
    expect(input).not.toBeRequired();
    expect(screen.getByText("(optional)")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Tailscale settings" });
    expect(link).toHaveAttribute("href", "https://login.tailscale.com/admin/settings/keys");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(input).toHaveAccessibleDescription(/Make a reusable key/);
  });

  it("Show / Hide toggles the secret", () => {
    render(<InstallerInterface {...props(tsManifest())} />);
    const input = screen.getByLabelText(/Tailscale auth key/);
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("sends the typed value (trimmed) through updateUserSetEnvs and installs", () => {
    const p = props(tsManifest());
    render(<InstallerInterface {...p} />);
    fireEvent.change(screen.getByLabelText(/Tailscale auth key/), { target: { value: "  tskey-auth-abc \n" } });
    expect(p.updateUserSetEnvs).toHaveBeenLastCalledWith({ dnpName: TS, key: "TS_AUTHKEY", value: "tskey-auth-abc" });
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(p.install).toHaveBeenCalledWith(TS, {});
  });

  it("an optional field left empty does not block Install", () => {
    const p = props(tsManifest());
    render(<InstallerInterface {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(p.install).toHaveBeenCalledWith(TS, {});
    expect(p.updateUserSetEnvs).not.toHaveBeenCalled();
  });

  it("a required field blocks Install until it is filled", () => {
    const p = props(tsManifest([{ ...field, title: "Name", secret: false, required: true }]));
    render(<InstallerInterface {...p} />);
    const input = screen.getByLabelText(/Name/);
    expect(input).toHaveAttribute("type", "text");
    expect(input).toBeRequired();
    expect(screen.queryByText("(optional)")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeDisabled();
    expect(screen.getByText("Fill in the fields above to install.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Install" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "box" } });
    expect(screen.getByRole("button", { name: "Install" })).toBeEnabled();
    expect(screen.queryByText("Fill in the fields above to install.")).not.toBeInTheDocument();
  });

  it("a true/false field is a switch and a list is a drop-down, both starting at the package default; nothing is sent until changed", () => {
    const m = {
      ...tsManifest([
        { id: "exit", target: { type: "environment", name: "EXIT_NODE" }, title: "Use as exit node", enum: ["true", "false"] },
        { id: "lang", target: { type: "environment", name: "LANG" }, title: "Language", enum: ["eng", "deu"] },
      ]),
      image: { size: 1, environment: ["EXIT_NODE=false", "LANG=deu"] },
    };
    const p = props(m);
    render(<InstallerInterface {...p} />);
    const sw = screen.getByRole("switch", { name: "Use as exit node" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText(/Language/)).toHaveValue("deu");
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    expect(p.updateUserSetEnvs).not.toHaveBeenCalled();
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(p.updateUserSetEnvs).toHaveBeenLastCalledWith({ dnpName: TS, key: "EXIT_NODE", value: "true" });
    fireEvent.change(screen.getByLabelText(/Language/), { target: { value: "eng" } });
    expect(p.updateUserSetEnvs).toHaveBeenLastCalledWith({ dnpName: TS, key: "LANG", value: "eng" });
  });

  it("a required drop-down without a default blocks Install until a value is chosen", () => {
    const p = props(tsManifest([{ id: "lang", target: { type: "environment", name: "LANG" }, title: "Language", enum: ["eng", "deu"], required: true }]));
    render(<InstallerInterface {...p} />);
    expect(screen.getByRole("button", { name: "Install" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Choose…" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Language/), { target: { value: "eng" } });
    expect(screen.getByRole("button", { name: "Install" })).not.toBeDisabled();
  });

  it("is not asked on an update", () => {
    const p = props(tsManifest(), [{ name: TS, version: "0.0.9" }]);
    render(<InstallerInterface {...p} />);
    expect(screen.queryByLabelText(/Tailscale auth key/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update to 0.1.0" }));
    expect(p.install).toHaveBeenCalledWith(TS, {});
  });

  it("a package without fields shows no inputs", () => {
    const { container } = render(<InstallerInterface {...props(manifest)} />);
    expect(container.querySelector("input")).toBeNull();
    expect(screen.getByRole("button", { name: "Install" })).toBeEnabled();
    expect(screen.queryByText("Fill in the fields above to install.")).not.toBeInTheDocument();
  });

  it("shows no raw HTML from the description", () => {
    const { container } = render(<InstallerInterface {...props(tsManifest([{ ...field, description: "Paste <img src=x onerror=alert(1)> it [bad](javascript:alert(1))" }]))} />);
    expect(container.querySelector("img[src='x']")).toBeNull();
    expect(screen.queryByRole("link", { name: "bad" })).not.toBeInTheDocument();
    expect(screen.getByText(/bad/)).toBeInTheDocument();
  });
});
