import { screen, act, fireEvent } from "@testing-library/react";
import { confirm } from "components/ConfirmDialog";

const open = props =>
  act(() => {
    confirm({ title: "Sure?", text: "Text", label: "Go", onClick: vi.fn(), ...props });
  });
const close = () =>
  act(() => {
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  });

describe("confirm", () => {
  it("draws the confirm button red by default", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Go" }).className).toContain("bg-danger-solid");
    await close();
  });

  it("draws it as a primary button when asked (an action that removes nothing)", async () => {
    const onClick = vi.fn();
    await open({ variant: "primary", onClick });
    const go = screen.getByRole("button", { name: "Go" });
    expect(go.className).toContain("bg-accent");
    expect(go.className).not.toContain("bg-danger-solid");
    await act(() => {
      fireEvent.click(go);
    });
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
