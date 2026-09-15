# Pulsar conformance suite

These vectors turn the prose in `../spec/protocol.md` into inputs and expected
outputs. An implementation in any language is conformant when its runner
produces the expected output for every vector here. This is what makes a Python
or Go implementation checkable without reading TypeScript.

The vectors belong to the spec version in `../VERSION`. They change only
alongside a normative change in the same release. A vector edit not tied to a
spec change is a bug.

## Vector files

    vectors/header-serialization.json   Canonical serialization of challenges
                                         and proofs.
    vectors/header-parsing.json         Parsing, including malformed inputs.
    vectors/nonce-validation.json       Nonce grammar, store presence, single
                                         use, and expiry, independent of chain.
    vectors/verification-verdicts.json  Full verification against a supplied
                                         transaction, returning a verdict code.

Each file is a JSON object with a `spec_version` string and a `vectors` array.
Each vector has an `id`, a human `description`, an `input`, and an `expect`.

## Runner contract

An implementation ships a runner that reads exactly one JSON request object on
stdin and writes exactly one JSON response object on stdout, then exits. The
request is:

    { "kind": "<kind>", "input": <the vector's input> }

The response is:

    { "output": <value to compare against the vector's expect> }

`kind` is one of `header-serialize`, `header-parse`, `nonce-validate`, `verify`.
A driver runs every vector by sending `{ "kind": <file's kind>, "input": v.input }`
and asserting `response.output` deep-equals `v.expect`. No wall-clock, network,
or filesystem access is needed: every time and every chain fact a vector depends
on is in its `input`.

The clock-skew grace `SKEW` is fixed at 5 seconds for conformance, matching the
recommended value in the spec.

### kind: header-serialize

    input : { "type": "challenge" | "credentials", "params": { ... } }
    output: { "header": "<canonical header value>" }

`params` for a challenge: `network`, `asset`, `amount`, `pay_to`, `nonce`,
`expires`, and optional `error`. For credentials: `tx`, `nonce`. The output
`header` is the field value only, beginning with `Pulsar `, serialized in the
canonical order and spacing of protocol section 3.3.

### kind: header-parse

    input : { "type": "challenge" | "credentials", "header": "<header value>" }
    output (success): { "ok": true, "params": { ... } }
    output (failure): { "ok": false, "error": "malformed_request" }

On success, `params` holds every parsed parameter as a string. Parsing is
order- and whitespace-tolerant per the ABNF; any grammar violation, duplicate
parameter, missing required parameter, unknown parameter, or uppercase hex in
`nonce` or `tx` yields the failure form.

### kind: nonce-validate

    input : {
      "nonce": "<nonce string as received>",
      "now": <Unix seconds>,
      "record": null | { "used": <bool>, "expires": <Unix seconds> }
    }
    output: { "verdict": "valid" | "malformed_request"
                          | "unknown_nonce" | "nonce_used" | "nonce_expired" }

`record` is the provider's stored entry for this nonce, or `null` when the nonce
was never issued or has been evicted. The runner applies, in order: nonce grammar
(`malformed_request`), `record == null` (`unknown_nonce`), `record.used`
(`nonce_used`), `now > record.expires + 5` (`nonce_expired`), otherwise `valid`.
This kind covers the pre-chain checks only; the chain checks are in `verify`.

### kind: verify

    input : {
      "requirement": {
        "network": "stellar:testnet",
        "asset": "XLM" | "CODE:ISSUER",
        "amount": "<decimal>",
        "pay_to": "G...",
        "nonce": "<hex>",
        "expires": <Unix seconds>
      },
      "proof": { "tx": "<hex>", "nonce": "<hex>" },
      "now": <Unix seconds>,
      "nonce_record": null | { "used": <bool>, "expires": <Unix seconds> },
      "transaction": null | {
        "found": <bool>,
        "successful": <bool>,
        "memo_type": "hash" | "text" | "id" | "return" | "none",
        "memo": "<base64 of 32 bytes for a hash memo, else as-is>",
        "operations": [
          { "type": "payment", "destination": "G...",
            "asset": "XLM" | "CODE:ISSUER", "amount": "<decimal>" }
        ]
      }
    }
    output: { "verdict": "<code from protocol section 7>" }

The runner applies protocol section 6 in order. `transaction` is the verifier's
view of the resolved transaction and stands in for a Horizon lookup, so
`@pulsar/core` can be driven with a mocked client. `transaction == null` or
`found == false` yields `tx_not_found`. The expected memo for a `valid` verdict
is the base64 of `SHA-256(nonce)`; a runner computes that digest itself and
compares. Amounts are compared in integer stroops.

## Driving the suite from pulsar-js

`@pulsar/core` exposes the four operations behind this contract and pins a spec
version. Its CI checks out this repository at that tag and asserts every vector
passes. When this repository releases a new version, the implementation bumps the
pin in a deliberate commit.
