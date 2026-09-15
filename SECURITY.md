# Security policy

This repository holds a protocol specification and its conformance vectors. A
security issue here is a flaw in the design or a vector that asserts an unsafe
behavior, not a bug in running software. Implementation vulnerabilities belong in
`pulsar-js` or `pulsar-facilitator`.

## Reporting

Report privately. Do not open a public issue for a suspected vulnerability. Use
GitHub's private vulnerability reporting on this repository (the Security tab,
"Report a vulnerability"). If that is unavailable to you, email the maintainers
listed on the organization profile and mark the subject as a security report.

Include the spec version or commit, the section or vector involved, the concrete
attack, and what an implementation that follows the spec would do wrong. Expect
an acknowledgement within a few days. Please allow the maintainers time to
publish a corrected version before disclosing publicly.

## Sensitive surfaces

A report against the specification most plausibly concerns one of these:

- Replay. Any reading of the spec under which a consumed nonce can verify a
  second time, or a memo can be rebound to a different nonce.
- Amount handling. Any path where an amount comparison can be made to pass for
  an underpayment, including a place the prose fails to forbid float arithmetic.
- Verification order. Any ordering of the section 6 checks that leaks
  information or serves an unverified payment, or any verdict that a spec-faithful
  verifier could reach without confirming settlement.
- Expiry and skew. A skew rule that widens the replay window beyond what the
  threat model states.
- Conformance vectors. A vector whose expected output contradicts the normative
  text, since implementations trust the vectors.

The trust boundaries and the accepted, out-of-scope risks are stated in
`spec/security.md`. A report that an out-of-scope risk exists is not a
vulnerability in the protocol; a report that an in-scope guarantee is breakable
is.

## Scope

In scope: the normative text in `spec/`, the conformance vectors in
`conformance/`, and the channel sketch in `contracts/` insofar as it constrains
the current protocol. Out of scope: typos, prose clarity, and anything an
implementation gets wrong on its own.
