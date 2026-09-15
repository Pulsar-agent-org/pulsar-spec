# Pulsar Security Model, version 0.1.0

This document states what the protocol in `protocol.md` defends against and what
it does not. A threat listed as out of scope is not a defect; it is a boundary a
deployment must handle by other means or accept.

The trust model: the client and the provider do not trust each other. Both trust
the Stellar network for settlement finality. A provider MAY delegate
verification to a facilitator, in which case the provider trusts that facilitator
to run the checks in section 6 honestly.

## Replay of a payment

A captured proof (`tx`, `nonce`) must not buy a second response.

Handled. A nonce is single-use (protocol section 4). The first successful
verification consumes it atomically; every later presentation returns
`nonce_used`. The memo binds the transaction to exactly one nonce, so an
attacker cannot point an old payment at a fresh nonce. Replay protection is an
invariant: any change that lets a consumed nonce verify again is a defect, and a
change here requires a test proving a replay fails.

Residual risk. Single-use enforcement is only as durable as the nonce store. The
v0.1 reference store is in-memory; a provider that restarts loses its record of
consumed nonces, and a proof replayed inside the original expiry window would
verify a second time. The persistent nonce store that closes this gap is the
most urgent open task. See `../ISSUES.md`.

## Front-running a nonce

An observer sees a challenge and tries to claim the response by paying first, or
tries to bind their own payment to a nonce issued to someone else.

Handled for the on-chain step. The memo must equal `SHA-256(nonce)`, so any
payment that verifies against a nonce carries that nonce's memo regardless of who
sent it. The `Authorization` retry needs only the transaction hash and the
nonce, both public once the challenge is issued, so whoever presents a valid
proof first is served and the nonce is consumed. In direct mode this is the
intended behavior: the response is not bound to a client identity, it is bound to
a settled payment. A provider that needs to bind a response to a caller identity
must add authentication above Pulsar; the protocol does not provide it.

Not handled. Pulsar does not defend against a network peer that observes a
client's own valid proof in transit and races it to the provider. Proofs SHOULD
travel over TLS. Even so, a first-past-the-post consumption means an intercepted
proof can be spent by the interceptor. This is a property of a bearer proof, and
v0.1 accepts it.

## Underpaying client

A client pays less than the challenge amount and expects the response.

Handled. Verification compares the paid amount to the stored requirement in
integer stroops and returns `insufficient_amount` when the payment falls short
(section 6). The comparison uses the provider's stored requirement, not any
value the client echoes, so a client cannot lower the price by editing a header.
Amounts never pass through a binary float, so rounding cannot be used to shave a
payment.

## Lying facilitator

A provider delegates verification to a facilitator that returns `valid` for a
payment that did not settle, or `invalid` for one that did.

Not handled by the protocol. A provider that delegates verification trusts the
facilitator. A dishonest facilitator that reports `valid` can make a provider
serve unpaid responses; one that reports `invalid` can deny service. The protocol
reduces the damage in two ways: the facilitator is stateless and holds no funds,
so a compromise leaks no balances, and its verdict is checkable, because the
inputs (a transaction hash and a requirement) are public and any party can
re-run section 6 against Horizon. A provider that cannot tolerate this trust
SHOULD verify in-process with `@pulsar/core` rather than delegate. Reputation,
multiple independent facilitators, or on-chain settlement records are mitigations
a deployment may add; none are part of v0.1.

## Provider takes payment and does not serve

A client pays and the provider keeps the money without returning the response.

Not handled. Direct mode settles payment before the response is served, so a
provider can always take a payment and withhold the result. This is the
fundamental limit of pay-then-serve without an escrow. The per-call amounts are
small by design, which caps the loss from any one bad provider, and a client
enforces its own `maxPerCall` and `maxTotal` budgets so a misbehaving host cannot
drain it. Fair exchange, where payment and delivery are atomic, requires the
payment-channel and voucher mechanism sketched in `../contracts/README.md` and is
not part of v0.1.

## Clock skew

The client, the provider, and Horizon do not share a clock, so a nonce may look
expired to one party and live to another.

Handled within a bound. Expiry is checked as `now > expires + SKEW`, with a
recommended 5-second grace, so a verification that is marginally late still
succeeds (section 4). The grace applies only at the expiry boundary. A
deployment whose components drift by more than a few seconds should run NTP
rather than widen `SKEW`, because a large grace lengthens the window in which a
lost in-memory nonce record could be replayed.

## Amount and float safety

Because a rounding error on a payment path is a class of bug, not a one-off, the
protocol forbids binary-float arithmetic on any amount and compares only in
integer stroops. An implementation that parses `amount` into a floating-point
number, even transiently, is non-conformant.

## Out of scope in v0.1

- Mainnet. Only Testnet is defined; a mainnet deployment is undefined here.
- Payment channels and vouchers, which would provide fair exchange and amortized
  settlement.
- Persistent, durable nonce storage across restarts and across replicas.
- Denial of service against a provider's Horizon dependency or its nonce store.
  Rate limiting is a facilitator concern, documented there, and does not defend
  the settlement path.
- Confidentiality of which resource a client bought. The nonce, amount, and
  transaction are public.
