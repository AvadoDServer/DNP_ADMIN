// Usage: node check-cert.js <cert.pem> <key.pem>
// Exit 0 when the certificate covers admin.my.ava.do, is valid for at least
// one more day and belongs to the key; 1 otherwise (with the reason).
const fs = require("fs");
const crypto = require("crypto");

const NAME = "admin.my.ava.do";
const DAY_MS = 24 * 60 * 60 * 1000;

try {
  const cert = new crypto.X509Certificate(fs.readFileSync(process.argv[2]));
  const key = crypto.createPrivateKey(fs.readFileSync(process.argv[3]));
  if (!cert.checkHost(NAME)) throw Error(`the certificate is not for ${NAME}`);
  if (Date.parse(cert.validFrom) > Date.now()) throw Error(`the certificate is valid only from ${cert.validFrom}`);
  if (Date.parse(cert.validTo) - Date.now() < DAY_MS) throw Error(`the certificate ends ${cert.validTo}`);
  if (!cert.checkPrivateKey(key)) throw Error("the key does not belong to the certificate");
  console.log(`certificate for ${NAME} valid until ${cert.validTo}`);
} catch (e) {
  console.log(`no secure address: ${e.message}`);
  process.exit(1);
}
