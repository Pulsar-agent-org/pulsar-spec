// Structural validator for the conformance vectors. It checks that the vector
// files agree with VERSION and use only known verdict codes. It deliberately
// does not implement the protocol: this repository ships no implementation, and
// an implementation validating its own test data would prove nothing.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(join(root, "VERSION"), "utf8").trim();

const VERDICTS = new Set([
  "payment_required",
  "malformed_request",
  "unknown_nonce",
  "nonce_used",
  "nonce_expired",
  "tx_not_found",
  "tx_failed",
  "memo_mismatch",
  "wrong_destination",
  "wrong_asset",
  "insufficient_amount",
  "valid",
]);

const errors = [];
const seenIds = new Set();

const vectorsDir = join(root, "conformance", "vectors");
const files = readdirSync(vectorsDir).filter((f) => f.endsWith(".json"));

if (files.length === 0) errors.push("no vector files found");

for (const file of files) {
  const path = join(vectorsDir, file);
  let doc;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`${file}: invalid JSON: ${e.message}`);
    continue;
  }
  if (doc.spec_version !== version) {
    errors.push(
      `${file}: spec_version ${doc.spec_version} does not match VERSION ${version}`,
    );
  }
  if (!doc.kind) errors.push(`${file}: missing kind`);
  if (!Array.isArray(doc.vectors)) {
    errors.push(`${file}: vectors is not an array`);
    continue;
  }
  for (const v of doc.vectors) {
    const where = `${file}:${v.id ?? "<no id>"}`;
    if (!v.id) errors.push(`${where}: missing id`);
    else if (seenIds.has(v.id)) errors.push(`${where}: duplicate id`);
    else seenIds.add(v.id);
    if (!v.description) errors.push(`${where}: missing description`);
    if (v.input === undefined) errors.push(`${where}: missing input`);
    if (v.expect === undefined) errors.push(`${where}: missing expect`);

    if (doc.kind === "nonce-validate" || doc.kind === "verify") {
      if (!VERDICTS.has(v.expect?.verdict)) {
        errors.push(`${where}: unknown verdict ${v.expect?.verdict}`);
      }
    }
    if (doc.kind === "header-serialize") {
      if (typeof v.expect?.header !== "string" || !v.expect.header.startsWith("Pulsar ")) {
        errors.push(`${where}: header must be a string beginning with "Pulsar "`);
      }
    }
    if (doc.kind === "header-parse") {
      if (typeof v.expect?.ok !== "boolean") {
        errors.push(`${where}: expect.ok must be a boolean`);
      } else if (v.expect.ok === false && v.expect.error !== "malformed_request") {
        errors.push(`${where}: a parse failure must expect malformed_request`);
      } else if (v.expect.ok === true && typeof v.expect.params !== "object") {
        errors.push(`${where}: a parse success must expect a params object`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`validate: ${errors.length} problem(s) for spec ${version}`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`validate: ${seenIds.size} vectors valid for spec ${version}`);
