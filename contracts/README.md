# Payment channels, planned, not implemented

Direct mode settles one Stellar payment per paid call. That is simple and needs
no contract, but it puts one on-chain transaction on the critical path of every
request, and it offers no fair exchange: a client pays before it is served. A
payment channel addresses both by moving most calls off-chain and settling once.

This document sketches the planned design so a contributor can pick it up. It is
not part of v0.1, and nothing here is implemented. The direct-mode protocol in
`../spec/protocol.md` does not depend on any of it.

## Shape

A channel is a funded, time-bounded agreement between one client and one
provider. The client locks a balance the provider can draw against by presenting
signed vouchers. Each paid call spends one voucher off-chain; the chain is
touched only to open, to close, or to resolve a dispute.

On Stellar this is expected to use a two-party arrangement: funds held so that a
release requires either both signatures or a single signature after a timeout.
The exact construction (a claimable balance, a multisig account, or a Soroban
contract) is open and is the largest single decision here. A Soroban contract is
the most flexible and is the current leaning, because it can encode the voucher
check and the dispute path directly.

## Voucher format, draft

A voucher is a signed statement that the provider may claim up to a cumulative
amount from the channel. Vouchers are monotonic: each carries a running total,
not a per-call delta, so a lost voucher costs nothing and the provider always
claims the highest one it holds.

Draft fields:

    channel_id     Identifier of the funded channel.
    epoch          Channel generation, to invalidate vouchers after a reset.
    cumulative     Total stroops authorized so far, as an integer string.
    nonce          The Pulsar challenge nonce this voucher answers, so a voucher
                   binds to a specific call the same way a memo does today.
    expires        Unix seconds after which this voucher is not claimable.
    signature      Client signature over the canonical encoding of the above.

The provider verifies a voucher off-chain by checking the signature, that
`cumulative` does not exceed the channel's funded balance, and that
`cumulative` is greater than the highest voucher already redeemed. Settlement
submits only the final, highest voucher.

## Verification reuse

Voucher verification should reuse the Pulsar verdict vocabulary where it
overlaps: an expired voucher maps to `nonce_expired`, an over-draw maps to
`insufficient_amount` inverted (the provider claims too much), and a bad
signature is a new code. Channel mode will add codes to the error table in
`../spec/protocol.md` through the same proposal process as any protocol change.

## Open questions

- Which Stellar primitive holds the funds and enforces the timeout.
- The canonical byte encoding a voucher signs over, which must be specified as
  exactly as the header grammar is today, or channels will not interoperate.
- Dispute resolution: what a provider submits on-chain when a client stops
  cosigning, and how a client reclaims an unspent balance after the timeout.
- Whether a facilitator can settle vouchers on a provider's behalf without
  holding the provider's keys.

These belong in a written proposal before any contract is written. See
`../CONTRIBUTING.md`.
