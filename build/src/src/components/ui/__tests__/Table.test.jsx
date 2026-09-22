import React from "react";
import { render, screen } from "@testing-library/react";
import { Table, THead, TBody, TR, TH, TD } from "../Table";

describe("Table TH", () => {
  it("renders column headers in sentence case, without forcing uppercase", () => {
    render(
      <Table>
        <THead>
          <TR>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          <TR>
            <TD>Running</TD>
          </TR>
        </TBody>
      </Table>
    );

    const th = screen.getByRole("columnheader", { name: "Status" });
    expect(th).not.toHaveClass("uppercase");
    expect(th.className).not.toMatch(/tracking-wide/);
  });
});
