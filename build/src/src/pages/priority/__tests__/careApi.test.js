import { createHash } from "node:crypto";

const { clientGet, clientPost, directGet, signMock } = vi.hoisted(() => ({
  clientGet: vi.fn(),
  clientPost: vi.fn(),
  directGet: vi.fn(),
  signMock: vi.fn()
}));

vi.mock("axios", () => ({
  default: { create: () => ({ get: clientGet, post: clientPost }), get: directGet }
}));
vi.mock("API/rpcMethods", () => ({ default: { signPrioritySupportRequest: signMock } }));

import {
  getCareSettings,
  setCareSettings,
  getCareStatus,
  signCareRequest,
  toCareError
} from "pages/priority/careApi";
import { createCheckout } from "pages/priority/priorityApi";

const NODE = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23";
const sha = s => createHash("sha256").update(s).digest("hex");
const httpError = (status, data = {}) => Object.assign(new Error("x"), { response: { status, data } });

beforeEach(() => {
  vi.resetAllMocks();
  clientGet.mockResolvedValue({ data: { hasSubscription: true, serverTime: 1790000000 } });
  signMock.mockImplementation(async ({ action, timestamp, payloadHash }) => ({
    nodeid: NODE.toLowerCase(),
    timestamp,
    signature: "0xsig",
    action,
    payloadHash
  }));
});

describe("signCareRequest", () => {
  it("signs the sha256 of the exact payload string with the backend's time (contract A)", async () => {
    const body = await signCareRequest(NODE, "care-settings", { v: 1, op: "get" });
    const payload = '{"v":1,"op":"get"}';
    expect(signMock).toHaveBeenCalledWith({
      action: "care-settings",
      timestamp: 1790000000,
      payloadHash: sha(payload)
    });
    expect(signMock.mock.calls[0][0]).not.toHaveProperty("plan");
    expect(body).toEqual({
      nodeId: NODE.toLowerCase(),
      timestamp: 1790000000,
      signature: "0xsig",
      payload
    });
  });

  it("asks for a system update when the DAPPMANAGER only knows checkout/portal", async () => {
    signMock.mockRejectedValue(new Error("kwarg action must be one of: checkout, portal"));
    await expect(signCareRequest(NODE, "care-settings", { v: 1, op: "get" })).rejects.toMatchObject({
      code: "needs_update",
      message: expect.stringMatching(/needs a system update/)
    });
  });

  it("asks for a system update when the signing call does not exist", async () => {
    signMock.mockRejectedValue(new Error("wamp.error.no_such_procedure"));
    await expect(signCareRequest(NODE, "care-settings", {})).rejects.toMatchObject({ code: "needs_update" });
  });

  it("asks for a system update when the DAPPMANAGER signed another payload", async () => {
    signMock.mockResolvedValue({ nodeid: NODE, timestamp: 1, signature: "0x", payloadHash: "00".repeat(32) });
    await expect(signCareRequest(NODE, "care-settings", {})).rejects.toMatchObject({ code: "needs_update" });
  });

  it("explains other signing failures in plain words", async () => {
    signMock.mockRejectedValue(new Error("This AVADO has no identity yet"));
    await expect(signCareRequest(NODE, "care-settings", {})).rejects.toThrow(
      /could not sign the request \(This AVADO has no identity yet\)/
    );
  });

  it("reports the service as unreachable when the status call fails", async () => {
    clientGet.mockRejectedValue(new Error("Network Error"));
    await expect(signCareRequest(NODE, "care-settings", {})).rejects.toMatchObject({ code: "unreachable" });
    expect(signMock).not.toHaveBeenCalled();
  });
});

describe("care settings (contract B)", () => {
  it("posts the signed get request to /care/settings", async () => {
    const settings = { email: null, verified: false, prefs: {}, trialEligible: false };
    clientPost.mockResolvedValue({ data: settings });
    await expect(getCareSettings(NODE)).resolves.toEqual(settings);
    expect(clientPost).toHaveBeenCalledWith("/care/settings", {
      nodeId: NODE.toLowerCase(),
      timestamp: 1790000000,
      signature: "0xsig",
      payload: '{"v":1,"op":"get"}'
    });
  });

  it("sends email and all four prefs as booleans on set", async () => {
    clientPost.mockResolvedValue({ data: {} });
    await setCareSettings(NODE, { email: "a@b.co", prefs: { offline: 1, critical: false, updates: true } });
    const body = clientPost.mock.calls[0][1];
    expect(JSON.parse(body.payload)).toEqual({
      v: 1,
      op: "set",
      email: "a@b.co",
      prefs: { offline: true, critical: false, updates: true, monthly: false }
    });
    expect(signMock.mock.calls[0][0].payloadHash).toBe(sha(body.payload));
  });

  it("omits fields that are not being changed", async () => {
    clientPost.mockResolvedValue({ data: {} });
    await setCareSettings(NODE, { email: "a@b.co" });
    expect(JSON.parse(clientPost.mock.calls[0][1].payload)).toEqual({ v: 1, op: "set", email: "a@b.co" });
  });

  it("turns backend errors into plain messages", async () => {
    clientPost.mockRejectedValue(httpError(400, { error: "That email address does not look right." }));
    await expect(getCareSettings(NODE)).rejects.toThrow("That email address does not look right.");
  });
});

describe("toCareError", () => {
  it.each([
    [undefined, "unreachable", /internet connection/],
    [401, "bad_signature", /could not confirm/],
    [402, "not_subscribed", /not active/],
    [404, "not_available", /not available yet/],
    [429, "rate_limited", /wait a minute/],
    [503, "server_error", /problem right now/],
    [409, "rejected", /Something went wrong/]
  ])("status %s -> %s", (status, code, message) => {
    const err = toCareError(status ? httpError(status) : new Error("Network Error"));
    expect(err.code).toBe(code);
    expect(err.message).toMatch(message);
  });

  it("uses the backend's own plain message for 409", () => {
    expect(toCareError(httpError(409, { error: "Please wait for the last change." })).message).toBe(
      "Please wait for the last change."
    );
  });
});

describe("getCareStatus (contract C)", () => {
  it("reads the same-origin proxy first", async () => {
    const status = { version: "0.1.0", lastHeartbeat: null };
    directGet.mockResolvedValueOnce({ data: status });
    await expect(getCareStatus()).resolves.toEqual(status);
    expect(directGet.mock.calls[0][0]).toBe("/care-api/status");
  });

  it("falls back to care.my.ava.do and ignores an HTML answer", async () => {
    directGet
      .mockResolvedValueOnce({ data: "<!doctype html>" })
      .mockResolvedValueOnce({ data: { version: "0.1.0" } });
    await expect(getCareStatus()).resolves.toEqual({ version: "0.1.0" });
    expect(directGet.mock.calls[1][0]).toBe("http://care.my.ava.do/api/status");
  });

  it("rejects with care_unreachable when nothing answers", async () => {
    directGet.mockRejectedValue(new Error("Network Error"));
    await expect(getCareStatus()).rejects.toMatchObject({ code: "care_unreachable" });
  });
});

describe("existing billing flow", () => {
  it("still signs checkout with {action, timestamp, plan} only", async () => {
    clientPost.mockResolvedValue({ data: { url: "https://checkout.stripe.com/x" } });
    await expect(createCheckout(NODE, "yearly")).resolves.toBe("https://checkout.stripe.com/x");
    expect(signMock).toHaveBeenCalledWith({ action: "checkout", timestamp: 1790000000, plan: "yearly" });
  });
});
