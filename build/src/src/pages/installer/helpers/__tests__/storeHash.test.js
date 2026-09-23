import { storeHashFor, isPlainName } from "pages/installer/helpers/storeHash";

const store = [
  { manifesthash: "/ipfs/QmAdmin", manifest: { name: "admin.dnp.dappnode.eth", version: "10.0.54" } },
  { manifesthash: "/ipfs/QmGrafana", manifest: { name: "grafana.avado.dappnode.eth", version: "0.0.4" } },
  { manifest: { name: "nohash.avado.dnp.dappnode.eth", version: "1.0.0" } },
];

describe("storeHashFor", () => {
  it("returns the store's manifest hash for a package name", () => {
    expect(storeHashFor("admin.dnp.dappnode.eth", store)).toBe("/ipfs/QmAdmin");
    expect(storeHashFor("grafana.avado.dappnode.eth", store)).toBe("/ipfs/QmGrafana");
  });

  it("returns null when the store doesn't list the package, has no hash, or hasn't loaded", () => {
    expect(storeHashFor("rotki.avado.dnp.dappnode.eth", store)).toBeNull();
    expect(storeHashFor("nohash.avado.dnp.dappnode.eth", store)).toBeNull();
    expect(storeHashFor("admin.dnp.dappnode.eth", null)).toBeNull();
  });

  it("leaves IPFS hashes and versioned requests alone", () => {
    expect(storeHashFor("/ipfs/QmAdmin", store)).toBeNull();
    expect(storeHashFor("admin.dnp.dappnode.eth@10.0.50", store)).toBeNull();
    expect(isPlainName("/ipfs/QmAdmin")).toBe(false);
    expect(isPlainName("admin.dnp.dappnode.eth")).toBe(true);
  });
});
