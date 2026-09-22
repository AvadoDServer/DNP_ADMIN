// Signed maintenance commands, run through `runSignedCmd` (see
// pages/system/actions.js -> API.runSignedCmd). The DAPPMANAGER verifies
// `sig` against `command` before running it, so these are copied
// byte-for-byte from the values that used to live inline in SystemHome.jsx.
// Never change a command string or its signature.
//
// Reboot has no signed command: it goes through the separate `rebootHost`
// RPC call (see actions.js), unchanged.

export const DISK_CLEANUP = {
  command: "docker image prune -a -f",
  sig: "0x1d12a4062ccf7d95d2dc82776bd56558d195993b4a3ebc0f0b89476134e393cc1ac5fa627139dddb97568a7ac5feab3225ad0ceba27872501fa1baa8a5ec618d1b",
};

export const SHUTDOWN = {
  command: "shutdown",
  sig: "0x8d40739e777533e8c85eed161640dc3307277a0c4a827abe13139cf2b777b52006af67e7c65bd4273fd2b2c5a60d907b38f5420c4eaff5f4eccc0c05cb6918e41b",
};
