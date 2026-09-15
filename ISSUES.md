# Backlog

Work that is deliberately not in v0.1, plus the implementation milestones that
build on this specification. Each item names its repository, a difficulty label,
and acceptance criteria. Items marked "not in v0.1" are contributor milestones,
not regressions: they were scoped out on purpose so v0.1 could ship the direct
handshake.

File an issue in the named repository when you pick one up, and link back here.

## pulsar-spec

### 1. JSON Schema for conformance vectors

Repo: pulsar-spec. Difficulty: good first issue.

A JSON Schema per vector kind, validated in CI alongside the structural checker.

Acceptance criteria:

- A schema file covers each of the four vector kinds.
- CI fails when a vector omits a required field or uses a wrong type.
- The existing 38 vectors pass unchanged.

### 2. More malformed header-parsing vectors

Repo: pulsar-spec. Difficulty: good first issue.

Cover parse failures the current vectors miss.

Acceptance criteria:

- Vectors for an unquoted value, a trailing comma, a duplicated nonce, and a
  missing scheme name.
- Each expects the `malformed_request` failure form.

### 3. Additional worked examples per verdict

Repo: pulsar-spec. Difficulty: good first issue.

Extend the worked example in protocol.md with real Testnet values for the
`insufficient_amount` and `memo_mismatch` verdicts.

Acceptance criteria:

- Each new example resolves to a real Testnet transaction.
- The described verdict follows from the section 6 rules.

### 4. Mainnet network token

Repo: pulsar-spec. Difficulty: intermediate. Not in v0.1.

Define a `stellar:pubnet` token and the rules that differ from Testnet, behind an
explicit opt-in so a misconfiguration cannot silently move funds on mainnet.

Acceptance criteria:

- The network token, passphrase, and asset issuers for mainnet are specified.
- The threat model states what changes when real value is at stake.
- A conformance vector shows a mainnet challenge serializing correctly.

### 5. Payment channel voucher encoding

Repo: pulsar-spec. Difficulty: intermediate. Not in v0.1.

Specify the canonical byte encoding a voucher signs over, precisely enough that
two implementations produce identical signatures.

Acceptance criteria:

- Every field, its type, and its byte layout are defined.
- A signing and verification test vector is included.

### 6. Payment channel protocol, end to end

Repo: pulsar-spec. Difficulty: advanced. Not in v0.1.

The full channel design: the Stellar primitive that holds funds, open and close
flows, the dispute path, and the new error codes. This is the largest single
piece of unclaimed work and needs a written proposal and a maintainer sign-off
before any normative text is written.

Acceptance criteria:

- A written proposal is accepted first.
- Open, off-chain spend, cooperative close, and dispute close are all specified.
- New error codes are added to the table with conformance vectors.

### 7. x402 translation appendix

Repo: pulsar-spec. Difficulty: intermediate. Not in v0.1.

A non-normative appendix mapping Pulsar to the x402 payment scheme so a gateway
can translate between them.

Acceptance criteria:

- A field-by-field mapping in both directions.
- The cases that do not translate are stated plainly.

## pulsar-js

### 8. @pulsar/core header serialization and parsing

Repo: pulsar-js. Difficulty: intermediate.

Implement canonical serialization and tolerant parsing of both headers.

Acceptance criteria:

- The `header-serialization` and `header-parsing` vectors pass in CI against a
  pinned spec version.
- No network access in this package.

### 9. @pulsar/core verifyPayment and conformance runner

Repo: pulsar-js. Difficulty: intermediate.

Implement `verifyPayment(proof, requirement)` with an injected Horizon client,
and a runner that drives the conformance suite.

Acceptance criteria:

- The `nonce-validation` and `verification-verdicts` vectors pass in CI.
- Amounts are handled in integer stroops with no float on any path.
- The runner reads one JSON request on stdin and writes one JSON response.

### 10. @pulsar/server framework-agnostic paywall

Repo: pulsar-js. Difficulty: intermediate.

`paywall({ price, payTo, asset, nonceStore, verifier })` as a pure function of a
request, before any framework wrapper.

Acceptance criteria:

- No payment yields a well-formed 402; a valid payment yields 200.
- A replayed nonce yields `nonce_used`; an expired nonce fails; an underpayment
  yields `insufficient_amount`.
- Price may be static or a function of the request.

### 11. Express, Hono, and Next.js adapters

Repo: pulsar-js. Difficulty: intermediate.

Thin wrappers over the paywall function for each framework.

Acceptance criteria:

- An existing Express or Hono endpoint is wrapped in about three lines.
- supertest covers 402, 200, replay, expiry, and underpayment for each adapter.

### 12. In-memory NonceStore and interface

Repo: pulsar-js. Difficulty: good first issue.

A documented `NonceStore` interface and an in-memory implementation with expiry.

Acceptance criteria:

- Single-use consumption is atomic under concurrent access.
- Expired entries are evicted.
- The interface is documented for alternative backends.

### 13. Persistent nonce store

Repo: pulsar-js. Difficulty: intermediate. Not in v0.1. Most urgent.

A durable `NonceStore` (Redis or Postgres) so a consumed nonce survives a
restart and is shared across replicas. This closes the replay window the
in-memory store leaves open and is the most urgent gap after v0.1.

Acceptance criteria:

- A consumed nonce stays consumed across a process restart.
- Two replicas cannot both consume the same nonce.
- A test proves a replay fails after a simulated restart.

### 14. @pulsar/client with budget caps and allowlist

Repo: pulsar-js. Difficulty: advanced.

`createPulsarClient({ secret, maxPerCall, maxTotal, allow })` returning a
fetch-compatible function that pays on a 402 and retries once.

Acceptance criteria:

- The per-call cap, the running total, and the host allowlist are all enforced
  before any transaction is signed.
- A cap or allowlist violation refuses with a typed error and signs nothing.
- The refusal paths are tested more thoroughly than the success path.

### 15. @pulsar/mcp withPulsar

Repo: pulsar-js. Difficulty: intermediate.

`withPulsar(server, { prices })` using the official MCP TypeScript SDK, carrying
the payment challenge as a structured tool error.

Acceptance criteria:

- A priced tool returns a structured challenge the client can act on.
- Documented in docs/mcp.md.

### 16. Runnable examples: paid-mcp-tool and paying-agent

Repo: pulsar-js. Difficulty: intermediate.

An MCP server with one priced tool, and an agent that discovers the price, pays
on Testnet, and prints the result.

Acceptance criteria:

- Both run from the commands in the README.
- The agent settles a real Testnet payment end to end.

### 17. LangChain adapter

Repo: pulsar-js. Difficulty: intermediate. Not in v0.1.

An adapter exposing a paid tool to LangChain agents.

Acceptance criteria:

- A LangChain tool pays through `@pulsar/client` within a budget.
- The refusal path surfaces as a tool error.

### 18. Vercel AI SDK adapter

Repo: pulsar-js. Difficulty: intermediate. Not in v0.1.

An adapter for the Vercel AI SDK tool interface.

Acceptance criteria:

- A paid tool is callable from the AI SDK.
- Budget refusals propagate as typed errors.

### 19. Python client

Repo: a new pulsar-py. Difficulty: advanced. Not in v0.1.

A client that drives the conformance suite and pays on Testnet, written from the
spec alone.

Acceptance criteria:

- The conformance vectors pass through a Python runner.
- The client pays within a budget and refuses to exceed it.

### 20. Provider dashboard

Repo: a new pulsar-dashboard. Difficulty: advanced. Not in v0.1.

A web view of a provider's paid calls, revenue, and nonce store health.

Acceptance criteria:

- Per-endpoint call and revenue counts.
- No secret keys in the browser.

### 21. Tool directory

Repo: a new pulsar-directory. Difficulty: advanced. Not in v0.1.

A registry where providers list priced tools and clients discover them.

Acceptance criteria:

- A provider can publish a tool, its price, and its endpoint.
- A client can discover and pay a listed tool.

## pulsar-facilitator

### 22. POST /verify and POST /settle

Repo: pulsar-facilitator. Difficulty: intermediate.

Stateless endpoints built on `@pulsar/core`, with a health endpoint, structured
JSON logs, and request tracing.

Acceptance criteria:

- /verify returns valid or invalid with a reason code from the spec table.
- /settle submits a transaction on behalf of a caller.
- No protocol logic is re-implemented; all of it comes from `@pulsar/core`.

### 23. Dockerfile and Compose for Testnet

Repo: pulsar-facilitator. Difficulty: intermediate.

A container image and a Compose file that bring the facilitator up against
Testnet in one command.

Acceptance criteria:

- `docker compose up` starts a working Testnet facilitator.
- Configuration is by environment variable with a committed example.

### 24. Rate limiting by IP and provider key

Repo: pulsar-facilitator. Difficulty: intermediate.

Configurable limits per client IP and per provider key.

Acceptance criteria:

- Limits are configurable and documented.
- Exceeding a limit returns a clear, rate-limited response.
- Rate limiting does not weaken the settlement checks.
