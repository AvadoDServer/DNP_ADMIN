import { createHash, webcrypto } from "node:crypto";
import { sha256Hex } from "pages/priority/sha256";

const nodeSha = s => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

const VECTORS = [
  ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  [
    "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
  ]
];

const SAMPLES = [
  "a".repeat(55),
  "a".repeat(56),
  "a".repeat(64),
  "x".repeat(1000),
  JSON.stringify({ v: 1, op: "set", email: "šđč@example.com", prefs: { offline: true } }),
  "emoji 🚀 and ü"
];

describe("sha256Hex", () => {
  it.each(VECTORS)("pure-JS matches the standard vector for %j", async (input, expected) => {
    expect(await sha256Hex(input, { useSubtle: false })).toBe(expected);
  });

  it.each(SAMPLES)("pure-JS matches node's sha256 for sample %#", async input => {
    expect(await sha256Hex(input, { useSubtle: false })).toBe(nodeSha(input));
  });

  it("uses SubtleCrypto when available and gives the same result", async () => {
    const original = globalThis.crypto;
    const digest = vi.fn((alg, data) => webcrypto.subtle.digest(alg, data));
    Object.defineProperty(globalThis, "crypto", { value: { subtle: { digest } }, configurable: true });
    try {
      for (const s of SAMPLES) expect(await sha256Hex(s)).toBe(nodeSha(s));
      expect(digest).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
    }
  });

  it("falls back to pure JS without crypto.subtle (the Admin over plain http)", async () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: {}, configurable: true });
    try {
      expect(await sha256Hex("abc")).toBe(VECTORS[1][1]);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
    }
  });

  it("returns 64 lowercase hex characters", async () => {
    expect(await sha256Hex('{"v":1,"op":"get"}')).toMatch(/^[0-9a-f]{64}$/);
  });
});
