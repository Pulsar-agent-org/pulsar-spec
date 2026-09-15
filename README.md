# pulsar-spec

Pulsar is a pay-per-call payment layer for HTTP APIs, AI agents, and MCP
servers. A server answers an unpaid request with `402 Payment Required` and a
challenge; the client pays a small amount of USDC (or XLM) on the Stellar
Testnet and retries with a proof of payment. Settlement is a normal Stellar
transaction. There is no account to open and no invoice to reconcile.

This repository is the normative specification and a language-agnostic
conformance suite. It contains no product code. An implementation in any
language is correct when it produces the verdicts in `conformance/` for the
inputs in `conformance/`.

## Status

Early and pre-release. Testnet only. Unaudited. The protocol is a first draft
open to change through the proposal process in `CONTRIBUTING.md`. Do not rely on
it for anything holding real value.

## The three repositories

Pulsar is split across three repositories in the `Pulsar-agent-org` GitHub
organization. Dependencies point in one direction only:

    pulsar-spec  ->  pulsar-js  ->  pulsar-facilitator

- **pulsar-spec** (this repo): the protocol, the threat model, and the
  conformance vectors.
- **pulsar-js**: the TypeScript implementation. Four npm packages built from
  one repository (`@pulsar/core`, `@pulsar/server`, `@pulsar/client`,
  `@pulsar/mcp`).
- **pulsar-facilitator**: a stateless verify-and-settle HTTP service and its
  Docker image, built on `@pulsar/core`.

An implementation depends on this specification. This specification never
depends on an implementation.

## The handshake

    GET /tools/summarize
    <- 402 Payment Required
       WWW-Authenticate: Pulsar network="stellar:testnet",
         asset="USDC:GBBD...", amount="0.002", pay_to="GA7Q...",
         nonce="9f1c...", expires="1789..."

    [client pays 0.002 USDC on Stellar Testnet, memo = SHA-256(nonce)]

    GET /tools/summarize
       Authorization: Pulsar tx="<hash>", nonce="9f1c..."
    <- 200 OK

Direct mode only in v0.1. Each paid call is one on-chain payment. Payment
channels, which amortize many calls over one settlement, are specified as a
future contract in `contracts/README.md` and are not part of v0.1.

## Repository map

    spec/protocol.md      Normative protocol: headers, nonce rules, memo
                          derivation, verification order, error table, and a
                          worked example with real Testnet values.
    spec/security.md      Threat model. Which attacks the protocol stops and
                          which it does not.
    conformance/          JSON test vectors and a JSON-in/JSON-out runner
                          contract that any implementation can drive.
    contracts/README.md   Sketch of the planned payment-channel contract and
                          voucher format. No implementation.
    VERSION               The spec version these vectors belong to.

## Running the conformance suite

The vectors are plain JSON. An implementation exposes a runner that reads one
vector on stdin and writes one result on stdout, as described in
`conformance/README.md`. To check an implementation, feed it every vector under
`conformance/vectors/` and compare its output to the `expect` field.

pulsar-js pins a spec version and runs these vectors in CI. When this repository
tags a release, an implementation bumps the pinned version deliberately, never
silently.

## Versioning

The spec is versioned in `VERSION` and by git tag. Conformance vectors change
only alongside a spec change in the same release, never on their own. A vector
edit that is not tied to a normative change is a bug.

## Contributing

See `CONTRIBUTING.md`. Protocol changes require a written proposal and a
maintainer sign-off before any vector or normative sentence changes. Report
security issues as described in `SECURITY.md`.

## License

Apache-2.0. See `LICENSE`.
