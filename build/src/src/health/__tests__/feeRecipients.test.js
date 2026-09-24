import { fetchFeeRecipients, readClientFeeRecipients, VALIDATOR_CLIENTS, MAX_KEYS_CHECKED } from "health/feeRecipients";

const NIMBUS = VALIDATOR_CLIENTS.find(c => c.name === "nimbus.avado.dnp.dappnode.eth");
const TEKU = VALIDATOR_CLIENTS.find(c => c.name === "teku.avado.dnp.dappnode.eth");
const pk = i => "0x" + String(i).padStart(2, "0").repeat(48);
const ADDR = "0x" + "ab".repeat(20);
const ZERO = "0x" + "0".repeat(40);
const zeroFee = () => [200, { data: { ethaddress: ZERO } }];

/**
 * A fake validator package: `keys` loaded (a function for a list that changes),
 * `fee(pubkey)` → [status, body], `chain` → the beacon node's { pubkey: status }
 * (or a [status, body] pair for a failing beacon node). Records every URL.
 */
function box({ keys, fee, chain = {} }) {
  const calls = [];
  const reply = (status, body) => ({ status, json: async () => body });
  const fetchImpl = async url => {
    calls.push(url);
    if (url.endsWith("/eth/v1/keystores")) {
      const list = typeof keys === "function" ? keys() : keys;
      return reply(200, { data: list.map(k => ({ validating_pubkey: k })) });
    }
    const m = url.match(/validator\/(0x[0-9a-f]+)\/feerecipient$/);
    if (m) return reply(...fee(m[1]));
    const b = url.match(/\/eth\/v1\/beacon\/states\/head\/validators\?id=(.*)$/);
    if (b) {
      if (Array.isArray(chain)) return reply(...chain);
      const data = b[1].split(",").filter(id => chain[id]).map(id => ({ status: chain[id], validator: { pubkey: id } }));
      return reply(200, { data });
    }
    return reply(404, { message: "NOT_FOUND" });
  };
  return { fetchImpl, calls };
}

describe("readClientFeeRecipients", () => {
  it("a zero address counts only for a validator that is active or exited on the beacon node", async () => {
    const { fetchImpl, calls } = box({
      keys: [pk(1), pk(2), pk(3), pk(4)],
      fee: k => (k === pk(4) ? [200, { data: { ethaddress: ADDR } }] : zeroFee()),
      chain: { [pk(1)]: "active_ongoing", [pk(2)]: "exited_slashed", [pk(3)]: "pending_queued" },
    });
    expect(await readClientFeeRecipients(NIMBUS, fetchImpl)).toEqual({ validators: 4, checked: 4, missing: 2 });
    const lookups = calls.filter(u => u.includes("/beacon/states/head/validators"));
    expect(lookups).toEqual([`http://nimbus.my.ava.do:5052/eth/v1/beacon/states/head/validators?id=${pk(1)},${pk(2)},${pk(3)}`]);
  });

  it("Nimbus answers zero for a pending 0x01 key (not in the chain state yet): no finding", async () => {
    const { fetchImpl } = box({ keys: [pk(1)], fee: zeroFee, chain: {} });
    expect(await readClientFeeRecipients(NIMBUS, fetchImpl)).toEqual({ validators: 1, checked: 1, missing: 0 });
  });

  it("a zero address with an unreadable beacon node does not count", async () => {
    const { fetchImpl } = box({ keys: [pk(1)], fee: zeroFee, chain: [503, { message: "not synced" }] });
    expect(await readClientFeeRecipients(NIMBUS, fetchImpl)).toEqual({ validators: 1, checked: 1, missing: 0 });
  });

  it("counts an explicit 'not set' answer for a key that is still loaded", async () => {
    const { fetchImpl } = box({ keys: [pk(1), pk(2)], fee: k => (k === pk(1) ? [500, { message: "no fee recipient set" }] : [200, { data: { ethaddress: ADDR } }]) });
    expect(await readClientFeeRecipients(NIMBUS, fetchImpl)).toEqual({ validators: 2, checked: 2, missing: 1 });
  });

  it("Teku: a key deleted between the list and its read is not counted", async () => {
    let listed = 0;
    const { fetchImpl } = box({
      keys: () => (listed++ === 0 ? [pk(1), pk(2)] : [pk(2)]),
      fee: k => (k === pk(1) ? [404, { message: "Fee recipient not found" }] : [200, { data: { ethaddress: ADDR } }]),
    });
    expect(await readClientFeeRecipients(TEKU, fetchImpl)).toEqual({ validators: 2, checked: 2, missing: 0 });
  });

  it("all keys with an address, or no keys: nothing missing and no beacon lookup", async () => {
    const a = box({ keys: [pk(1)], fee: () => [200, { data: { ethaddress: ADDR } }] });
    expect(await readClientFeeRecipients(NIMBUS, a.fetchImpl)).toEqual({ validators: 1, checked: 1, missing: 0 });
    expect(a.calls.some(u => u.includes("/beacon/"))).toBe(false);
    const b = box({ keys: [], fee: () => [200, {}] });
    expect(await readClientFeeRecipients(NIMBUS, b.fetchImpl)).toEqual({ validators: 0, checked: 0, missing: 0 });
  });

  it("can't read → null (never a guess)", async () => {
    // a bare 404 (unknown key, route missing on an old client) is ambiguous
    expect(await readClientFeeRecipients(NIMBUS, box({ keys: [pk(1)], fee: () => [404, { message: "Could not find validator" }] }).fetchImpl)).toBeNull();
    // the Prysm monitor answers every upstream error with 500 "failed"
    expect(await readClientFeeRecipients(NIMBUS, box({ keys: [pk(1)], fee: () => [500, { message: "failed" }] }).fetchImpl)).toBeNull();
    // network error
    expect(await readClientFeeRecipients(NIMBUS, async () => { throw new TypeError("Failed to fetch"); })).toBeNull();
    // an odd reply
    expect(await readClientFeeRecipients(NIMBUS, box({ keys: [pk(1)], fee: () => [200, { data: { ethaddress: "nope" } }] }).fetchImpl)).toBeNull();
  });

  it("checks at most MAX_KEYS_CHECKED keys", async () => {
    const keys = Array.from({ length: MAX_KEYS_CHECKED + 5 }, (_, i) => "0x" + (i + 1).toString(16).padStart(96, "0"));
    const r = await readClientFeeRecipients(NIMBUS, box({ keys, fee: () => [200, { data: { ethaddress: ADDR } }] }).fetchImpl);
    expect(r).toEqual({ validators: MAX_KEYS_CHECKED + 5, checked: MAX_KEYS_CHECKED, missing: 0 });
  });
});

describe("fetchFeeRecipients", () => {
  const running = [
    { name: "nimbus.avado.dnp.dappnode.eth", running: true },
    { name: "teku.avado.dnp.dappnode.eth", running: true },
    { name: "eth2validator.avado.dnp.dappnode.eth", running: true },
    { name: "lighthouse.avado.dnp.dappnode.eth", running: false },
    { name: "rotki.avado.dnp.dappnode.eth", running: true },
  ];

  it("reads only running validator clients and leaves unreadable ones out", async () => {
    const calls = [];
    const fetchImpl = async url => {
      calls.push(url);
      if (url.startsWith("http://teku") || url.startsWith("http://eth2validator")) throw new TypeError("Failed to fetch");
      return { status: 200, json: async () => ({ data: [] }) };
    };
    expect(await fetchFeeRecipients(running, fetchImpl)).toEqual({ "nimbus.avado.dnp.dappnode.eth": { validators: 0, checked: 0, missing: 0 } });
    expect(calls.some(u => u.startsWith("http://lighthouse"))).toBe(false);
  });

  it("null when validator clients run but none could be read (skipped, not 'passed')", async () => {
    expect(await fetchFeeRecipients(running, async () => { throw new TypeError("Failed to fetch"); })).toBeNull();
  });

  it("no validator client running → null", async () => {
    expect(await fetchFeeRecipients([{ name: "rotki.avado.dnp.dappnode.eth", running: true }], async () => ({}))).toBeNull();
  });

  it("in the browser (the Admin) no client is read: their CORS lists leave out http://my.ava.do", async () => {
    const calls = [];
    const r = await fetchFeeRecipients(running, async url => (calls.push(url), { status: 200, json: async () => ({ data: [] }) }), { browser: true });
    expect(r).toBeNull();
    expect(calls).toEqual([]);
  });
});
