import { fetchFeeRecipients, readClientFeeRecipients, VALIDATOR_CLIENTS, MAX_KEYS_CHECKED } from "health/feeRecipients";

const NIMBUS = VALIDATOR_CLIENTS.find(c => c.name === "nimbus.avado.dnp.dappnode.eth");
const pk = i => "0x" + String(i).padStart(2, "0").repeat(48);
const ADDR = "0x" + "ab".repeat(20);
const ZERO = "0x" + "0".repeat(40);

// A fake keymanager: `keys` loaded, `fee(pubkey)` → [status, body]
function keymanager(keys, fee, listStatus = 200) {
  return async url => {
    const reply = (status, body) => ({ status, json: async () => body });
    if (url.endsWith("/eth/v1/keystores")) return reply(listStatus, { data: keys.map(k => ({ validating_pubkey: k })) });
    const m = url.match(/validator\/(0x[0-9a-f]+)\/feerecipient$/);
    if (m) return reply(...fee(m[1]));
    return reply(404, { message: "NOT_FOUND" });
  };
}

describe("readClientFeeRecipients", () => {
  it("counts keys with the zero address or an explicit 'not set' answer", async () => {
    const fee = k =>
      k === pk(1) ? [200, { data: { pubkey: k, ethaddress: ZERO } }]
        : k === pk(2) ? [500, { code: 500, message: "no fee recipient set" }]
          : [200, { data: { pubkey: k, ethaddress: ADDR } }];
    const r = await readClientFeeRecipients(NIMBUS, keymanager([pk(1), pk(2), pk(3)], fee));
    expect(r).toEqual({ validators: 3, checked: 3, missing: 2 });
  });

  it("all keys with an address: nothing missing", async () => {
    const r = await readClientFeeRecipients(NIMBUS, keymanager([pk(1)], () => [200, { data: { ethaddress: ADDR } }]));
    expect(r).toEqual({ validators: 1, checked: 1, missing: 0 });
  });

  it("no keys loaded: zero validators", async () => {
    expect(await readClientFeeRecipients(NIMBUS, keymanager([], () => [200, {}]))).toEqual({ validators: 0, checked: 0, missing: 0 });
  });

  it("can't read → null (never a guess)", async () => {
    // a bare 404 (unknown key, route missing on an old client) is ambiguous
    expect(await readClientFeeRecipients(NIMBUS, keymanager([pk(1)], () => [404, { message: "Could not find validator" }]))).toBeNull();
    // the Prysm monitor answers every upstream error with 500 "failed"
    expect(await readClientFeeRecipients(NIMBUS, keymanager([pk(1)], () => [500, { message: "failed" }]))).toBeNull();
    // key list not readable
    expect(await readClientFeeRecipients(NIMBUS, keymanager([pk(1)], () => [200, {}], 502))).toBeNull();
    // network error
    expect(await readClientFeeRecipients(NIMBUS, async () => { throw new TypeError("Failed to fetch"); })).toBeNull();
    // an odd reply
    expect(await readClientFeeRecipients(NIMBUS, keymanager([pk(1)], () => [200, { data: { ethaddress: "nope" } }]))).toBeNull();
  });

  it("checks at most MAX_KEYS_CHECKED keys", async () => {
    const keys = Array.from({ length: MAX_KEYS_CHECKED + 5 }, (_, i) => "0x" + (i + 1).toString(16).padStart(96, "0"));
    const r = await readClientFeeRecipients(NIMBUS, keymanager(keys, () => [200, { data: { ethaddress: ADDR } }]));
    expect(r).toEqual({ validators: MAX_KEYS_CHECKED + 5, checked: MAX_KEYS_CHECKED, missing: 0 });
  });
});

describe("fetchFeeRecipients", () => {
  it("reads only running validator clients and leaves unreadable ones out", async () => {
    const calls = [];
    const fetchImpl = async url => {
      calls.push(url);
      if (url.startsWith("http://teku")) throw new TypeError("Failed to fetch");
      return { status: 200, json: async () => ({ data: [] }) };
    };
    const packages = [
      { name: "nimbus.avado.dnp.dappnode.eth", running: true },
      { name: "teku.avado.dnp.dappnode.eth", running: true },
      { name: "lighthouse.avado.dnp.dappnode.eth", running: false },
      { name: "rotki.avado.dnp.dappnode.eth", running: true },
    ];
    const r = await fetchFeeRecipients(packages, fetchImpl);
    expect(r).toEqual({ "nimbus.avado.dnp.dappnode.eth": { validators: 0, checked: 0, missing: 0 } });
    expect(calls.some(u => u.startsWith("http://lighthouse"))).toBe(false);
  });

  it("no validator client running → null", async () => {
    expect(await fetchFeeRecipients([{ name: "rotki.avado.dnp.dappnode.eth", running: true }], async () => ({}))).toBeNull();
  });
});
