import confirmSecondValidatorApp from "pages/installer/components/confirmSecondValidatorApp";
import { ONE_APP_PER_KEY, KEY_MOVE_WAIT_MINUTES } from "health/rules/validators";

const mockConfirm = vi.fn();
vi.mock("components/ConfirmDialog", () => ({
  confirm: (...args) => mockConfirm(...args),
}));

describe("confirmSecondValidatorApp", () => {
  beforeEach(() => mockConfirm.mockClear());

  it("names the installed app and the network, says one app per key, and gives the safe order", () => {
    const cb = vi.fn();
    confirmSecondValidatorApp(
      {
        app: { name: "teku.avado.dnp.dappnode.eth", manifest: { title: "Teku" } },
        network: "mainnet",
        others: [{ name: "nimbus.avado.dnp.dappnode.eth", manifest: { title: "Nimbus" } }],
      },
      cb
    );
    const [{ title, text, buttons }] = mockConfirm.mock.calls[0];
    expect(title).toBe("Nimbus is already installed for Ethereum mainnet");
    expect(text).toContain(ONE_APP_PER_KEY);
    expect(text).toContain(`Moving your validators to Teku? Install it, then remove them from Nimbus, wait at least ${KEY_MOVE_WAIT_MINUTES} minutes, and only then import them into Teku.`);
    expect(buttons).toEqual([{ label: "Install", onClick: cb }]);
  });

  it("lists several installed apps", () => {
    confirmSecondValidatorApp(
      {
        app: { name: "lighthouse.avado.dnp.dappnode.eth", manifest: { title: "Lighthouse" } },
        network: "mainnet",
        others: [
          { name: "nimbus.avado.dnp.dappnode.eth", manifest: { title: "Nimbus" } },
          { name: "teku.avado.dnp.dappnode.eth" },
        ],
      },
      () => {}
    );
    expect(mockConfirm.mock.calls[0][0].title).toBe("Nimbus and teku are already installed for Ethereum mainnet");
  });
});
