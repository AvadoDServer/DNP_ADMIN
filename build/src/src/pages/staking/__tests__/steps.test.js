import { stakingSteps } from "pages/staking/steps";

const p = name => ({ name, state: "running" });

describe("stakingSteps", () => {
  it("detects installed clients and leaves manual steps to the user", () => {
    const steps = stakingSteps([p("nimbus.avado.dnp.dappnode.eth")], {});
    const by = Object.fromEntries(steps.map(s => [s.id, s]));
    expect(by.execution.state).toBe("todo");
    expect(by.consensus.state).toBe("done");
    expect(by.keys).toMatchObject({ state: "todo", auto: false, action: { to: "/packages/nimbus.avado.dnp.dappnode.eth?tab=setup" } });
    expect(by.mev.state).toBe("optional");
    expect(by.monitoring.state).toBe("optional");
  });
  it("marks everything done when installed and ticked", () => {
    const steps = stakingSteps(
      ["ethchain-geth.public.dappnode.eth", "nimbus.avado.dnp.dappnode.eth", "mevboost.avado.dnp.dappnode.eth", "grafana.avado.dappnode.eth"].map(p),
      { keys: true, feeRecipient: true }
    );
    expect(steps.every(s => s.state === "done")).toBe(true);
  });
});
