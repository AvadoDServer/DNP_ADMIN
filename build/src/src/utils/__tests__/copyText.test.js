import copyText from "utils/copyText";

describe("copyText", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete document.execCommand;
  });

  it("on http uses a hidden textarea and execCommand, and removes the textarea", async () => {
    let selected;
    document.execCommand = vi.fn(() => {
      const area = document.querySelector("textarea");
      selected = area && area.value;
      return true;
    });
    await copyText("QmFullHash");
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(selected).toBe("QmFullHash");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("rejects when the browser does not copy", async () => {
    document.execCommand = vi.fn(() => false);
    await expect(copyText("x")).rejects.toThrow();
    expect(document.querySelector("textarea")).toBeNull();
  });
});
