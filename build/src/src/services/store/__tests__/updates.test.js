import { computeUpdates } from "services/store/updates";

const store = [
  { manifest: { name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.49" }, manifesthash: "/ipfs/QmA" },
  { manifest: { name: "grafana.avado.dappnode.eth", version: "0.0.4" }, manifesthash: "/ipfs/QmB" },
  { manifest: { name: "broken.avado.dnp.dappnode.eth", version: "latest" } },
];

describe("computeUpdates", () => {
  it("lists installed packages with a newer store version", () => {
    const installed = [
      { name: "nimbus.avado.dnp.dappnode.eth", version: "0.0.48" },
      { name: "grafana.avado.dappnode.eth", version: "0.0.4" },
      { name: "broken.avado.dnp.dappnode.eth", version: "1.0.0" },
      { name: "not-in-store.dnp.dappnode.eth", version: "1.0.0" },
    ];
    expect(computeUpdates(store, installed)).toEqual({
      "nimbus.avado.dnp.dappnode.eth": { from: "0.0.48", to: "0.0.49", hash: "/ipfs/QmA" },
    });
  });
  it("handles missing inputs", () => {
    expect(computeUpdates(undefined, undefined)).toEqual({});
  });
});
