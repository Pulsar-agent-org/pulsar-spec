# Contributing to pulsar-spec

You do not need to know Stellar to contribute here. This repository is prose and
JSON. The parts that touch a blockchain are explained below from the start.

## What this repository is, and the other two

Pulsar lets an HTTP endpoint charge a small amount per call. A server answers an
unpaid request with `402 Payment Required` and a challenge; the caller pays a
few tenths of a cent in USDC or XLM on the Stellar Testnet and retries with a
proof of payment.

Pulsar is three repositories in the `Pulsar-agent-org` organization, and they
depend on each other in one direction only:

    pulsar-spec  ->  pulsar-js  ->  pulsar-facilitator

- **pulsar-spec** (here): the normative protocol, the threat model, and the
  conformance vectors. No product code.
- **pulsar-js**: the TypeScript implementation. Four npm packages, one repo.
- **pulsar-facilitator**: a stateless verify-and-settle service, built on the
  `@pulsar/core` package from pulsar-js.

An implementation depends on this spec. This spec never depends on an
implementation. A change that would make the spec reference implementation
details is wrong by construction. When you change normative text, expect the
implementation repos to follow in their own pull requests, not the reverse.

## The 402 handshake in plain language

A Stellar payment is an ordinary transaction that moves an asset from one account
to another. Each account has a public address that starts with `G`. A
transaction can carry a small tag called a memo. Pulsar uses the memo to tie a
payment to a specific request. That is all the Stellar background you need to
read the spec.

The exchange:

    GET /tools/summarize
    <- 402 Payment Required
       WWW-Authenticate: Pulsar network="stellar:testnet", asset="XLM",
         amount="0.002", pay_to="GD4R...", nonce="90aa...", expires="1789..."

    The client sends 0.002 XLM to pay_to, with the memo set to SHA-256 of the
    nonce, then retries:

    GET /tools/summarize
       Authorization: Pulsar tx="d2fb...", nonce="90aa..."
    <- 200 OK

The `nonce` is a one-time random token. It is single-use and it expires. The
`amount` is compared in stroops, the indivisible unit of a Stellar asset, and
never as a floating-point number. The full rules, byte for byte, are in
`spec/protocol.md`.

## Repository map

    spec/protocol.md      The normative protocol. Start here.
    spec/security.md      What the protocol defends against and what it does not.
    conformance/          JSON vectors and the JSON-in/JSON-out runner contract.
    conformance/vectors/  The four vector files an implementation must pass.
    contracts/README.md   The planned payment-channel design. Not implemented.
    VERSION               The spec version the vectors belong to.
    README.md             Overview and orientation.

## Setup

Prerequisites:

- Node.js 20 or newer and pnpm 9 or newer, for validating vectors and for the
  cross-repo demo. Install pnpm with `npm install -g pnpm`.
- git, and a GitHub account.
- No Stellar account and no funds. Test accounts are created for free by a
  faucet called friendbot, on the Testnet only.

Clone and validate the vectors in this repository:

    git clone https://github.com/Pulsar-agent-org/pulsar-spec.git
    cd pulsar-spec
    node tools/validate.mjs

The validator checks that every vector file is well-formed, that ids are unique,
that `spec_version` matches `VERSION`, and that every verdict names a code from
the error table. It runs in CI on every push and pull request.

To see the protocol actually charge on Testnet, run the paid-MCP demo, which
lives in pulsar-js:

    git clone https://github.com/Pulsar-agent-org/pulsar-js.git
    cd pulsar-js
    pnpm install
    cp .env.example .env      # fund the printed address with friendbot when asked
    pnpm build
    pnpm --filter paid-mcp-tool start        # terminal one: the paid server
    pnpm --filter paying-agent start         # terminal two: discovers the price,
                                             # pays on Testnet, prints the result

The paying agent will print a `G...` address to fund. Paste it into
`https://friendbot.stellar.org/?addr=<address>` in a browser, then let the agent
retry. The demo settles a real Testnet payment and returns the tool output.

## Where to start

Unclaimed work, easiest first. Claim an issue by commenting on it before you
start, so two people do not build the same thing.

1. Add a JSON Schema for the vector files and validate against it in CI.
   Difficulty: good first issue.
2. Extend the header-parsing vectors with more malformed cases: an unquoted
   value, a trailing comma, a duplicated `nonce`. Difficulty: good first issue.
3. Add worked examples for additional verdicts to `spec/protocol.md`, each with
   real Testnet values. Difficulty: good first issue.
4. Write the canonical byte encoding a channel voucher signs over, in
   `contracts/README.md`, precisely enough to interoperate. Difficulty:
   intermediate.
5. Specify the **persistent nonce store**: the interface and semantics a durable,
   multi-replica store must meet so a consumed nonce survives a restart. This is
   the most urgent gap, because the in-memory store loses its record of spent
   nonces on restart and a replay can succeed inside the expiry window.
   Difficulty: intermediate.
6. Define a mainnet network token and the rules that differ from Testnet, behind
   an explicit opt-in. Difficulty: intermediate.
7. Specify **payment channels** end to end: the Stellar primitive that holds
   funds, the dispute path, and the new error codes. This is the largest single
   piece of unclaimed work and needs a written proposal first. Difficulty:
   advanced.

## Invariants a reviewer will send a pull request back for

- Weakening replay protection. A nonce is single-use and expires. Any change
  near this must ship a test proving a replayed proof fails.
- An amount compared as a float, or any amount path that is not integer stroops.
- A verdict reachable without confirming on-chain settlement, or any reordering
  of the section 6 checks that serves an unverified payment. Fail closed.
- A conformance vector changed without a matching normative change in the same
  pull request. Vectors track the spec; they do not move on their own.
- The spec referencing an implementation, or the dependency direction reversed.

## Code style and CI

The content here is Markdown and JSON. Wrap prose at roughly 80 columns. Two
spaces of indentation in JSON. Line endings are LF, enforced by
`.gitattributes`. Follow Conventional Commits: `docs(spec): ...`,
`test(conformance): ...`, `chore: ...`.

The exact commands CI runs:

    node tools/validate.mjs
    npx --yes prettier@3 --check "**/*.{json,md}"

Run both locally before you push. `prettier --write` fixes formatting.

## Pull request checklist

- [ ] The change is a single logical step with a Conventional Commit message.
- [ ] `node tools/validate.mjs` passes.
- [ ] `prettier --check` passes.
- [ ] Any vector change is paired with the normative change it reflects.
- [ ] A change near replay, amounts, or verification order adds or updates a test.
- [ ] No secret keys, and no mainnet configuration, are introduced.
- [ ] The dependency direction is intact: this repo references no implementation.

## Releases

The spec is versioned in `VERSION` and by git tag. A release bumps `VERSION`,
tags `vMAJOR.MINOR.PATCH`, and lists the normative changes. Conformance vectors
change only within a release that also changes the spec. Implementations pin a
spec version and bump it deliberately.

## Security reporting

Report vulnerabilities privately through GitHub's private vulnerability reporting
on this repository, not as a public issue. The sensitive surfaces are replay,
amount handling, verification order, expiry and skew, and any conformance vector
that contradicts the normative text. Full instructions are in `SECURITY.md`.

## Community norms

Protocol changes need a written proposal and a maintainer sign-off before any
normative sentence or vector changes. Open the proposal as an issue that states
the problem, the change, and its effect on existing implementations, and wait for
a maintainer to agree the approach before you write it. Editorial fixes, new test
vectors that match the current spec, and documentation improvements do not need a
proposal.

Be precise and be kind. Ambiguity in this repository becomes an interoperability
bug in someone else's language months later, so a review that pushes for an exact
sentence is doing its job.
