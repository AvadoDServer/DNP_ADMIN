import React from "react";
import { render, screen } from "@testing-library/react";
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
