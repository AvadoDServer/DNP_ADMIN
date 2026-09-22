import * as t from "./actionTypes";
import api from "API/rpcMethods";

// pages > system

export const setStaticIp = staticIp => ({
  type: t.SET_STATIC_IP,
  staticIp
});

export const rebootHost = () => () => {
  api.rebootHost();
}

// `cmd` ({ command, sig }) is sent to the backend as-is and must not gain
// extra keys (the whole object is transmitted, not just the signed
// `command` string) — the human label for the toast is passed separately.
export const runSignedCmd = (cmd, label) => () => {
  api.runSignedCmd(
    { cmd },
    { toastMessage: label ? `Running command: ${label}` : "Running command" }
  );
}
