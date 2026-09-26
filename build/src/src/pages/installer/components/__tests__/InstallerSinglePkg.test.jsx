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
