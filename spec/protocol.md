# Pulsar Protocol, version 0.1.0

Status: draft. This document is normative. The key words MUST, MUST NOT,
REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, and OPTIONAL
are to be interpreted as described in RFC 2119 and RFC 8174.

Pulsar turns a single HTTP request into a metered, paid call. A server that
requires payment answers with `402 Payment Required` and a challenge carried in
a `WWW-Authenticate` header. The client settles the amount as a Stellar payment
whose memo binds it to the challenge, then repeats the request with an
`Authorization` header naming the settling transaction. The server verifies the
payment on-chain and serves the response.

Version 0.1 covers direct mode only: one paid call settles as one Stellar
payment. Payment channels are out of scope and are sketched in
`../contracts/README.md`.

## 1. Terminology

- **Provider**: the server that gates a resource behind payment.
- **Client**: the caller that pays to obtain the resource.
- **Facilitator**: an optional stateless service a provider delegates
  verification and settlement to. It changes who runs the checks in section 6,
  not the checks themselves.
- **Challenge**: the parameters in a `WWW-Authenticate: Pulsar` header.
- **Requirement**: the challenge as stored by the provider, keyed by nonce. The
  provider verifies against its stored requirement, never against values echoed
  by the client.
- **Proof**: the `tx` and `nonce` in an `Authorization: Pulsar` header.
- **Stroop**: the indivisible unit of a Stellar asset, one ten-millionth of one
  whole unit. All amount comparisons in this protocol are integer comparisons in
  stroops.

## 2. Network and assets

Version 0.1 defines exactly one network token, `stellar:testnet`. It maps to:

- Network passphrase: `Test SDF Network ; September 2015`
- A Horizon endpoint the verifier trusts, for example
  `https://horizon-testnet.stellar.org`.

A verifier MUST resolve transactions on the network named by the challenge. A
mainnet configuration is not defined in v0.1 and MUST NOT be used with these
vectors.

An asset is either the native asset, written `XLM`, or a credit asset written
`CODE:ISSUER`, where `CODE` is the Stellar asset code and `ISSUER` is the
issuing account in strkey form (a 56-character key beginning with `G`). Amounts
are priced and compared in the asset named by the challenge. USDC is the
expected pricing asset; XLM is supported.

## 3. Headers

Both headers use the authentication framework of RFC 7235 with the scheme name
`Pulsar`. All parameter values are quoted-strings as defined in RFC 7230.

### 3.1 ABNF

The grammar uses the core rules of RFC 5234 (`DIGIT`, `ALPHA`, `SP`, `DQUOTE`)
and `OWS` from RFC 7230. `LHEXDIG` is lowercase hexadecimal only.

    LHEXDIG        = DIGIT / "a" / "b" / "c" / "d" / "e" / "f"

    ; --- Challenge: sent by the provider in WWW-Authenticate on a 402 ---
    challenge      = "Pulsar" 1*SP challenge-params
    challenge-params = challenge-param *( OWS "," OWS challenge-param )
    challenge-param  = network-p / asset-p / amount-p / payto-p
                     / nonce-p / expires-p / error-p

    network-p      = "network" "=" DQUOTE "stellar:" net-name DQUOTE
    net-name       = "testnet"                       ; only value in v0.1

    asset-p        = "asset" "=" DQUOTE asset-id DQUOTE
    asset-id       = "XLM" / ( asset-code ":" account-id )
    asset-code     = 1*12 ( ALPHA / DIGIT )
    account-id     = "G" 55( ALPHA / DIGIT )         ; Ed25519 strkey

    amount-p       = "amount" "=" DQUOTE decimal DQUOTE
    decimal        = int-part [ "." frac-part ]
    int-part       = "0" / ( NZDIGIT *DIGIT )
    frac-part      = 1*7 DIGIT
    NZDIGIT        = %x31-39                          ; 1-9

    payto-p        = "pay_to" "=" DQUOTE account-id DQUOTE

    nonce-p        = "nonce" "=" DQUOTE nonce-val DQUOTE
    nonce-val      = 32*128 LHEXDIG                   ; even length, >= 16 bytes

    expires-p      = "expires" "=" DQUOTE 1*DIGIT DQUOTE   ; Unix seconds, UTC

    error-p        = "error" "=" DQUOTE error-code DQUOTE  ; re-challenge only

    ; --- Proof: sent by the client in Authorization on the retry ---
    credentials    = "Pulsar" 1*SP credential-params
    credential-params = credential-param *( OWS "," OWS credential-param )
    credential-param  = tx-p / nonce-p
    tx-p           = "tx" "=" DQUOTE tx-hash DQUOTE
    tx-hash        = 64LHEXDIG

### 3.2 Required parameters

A challenge MUST carry `network`, `asset`, `amount`, `pay_to`, `nonce`, and
`expires`. It MUST carry `error` only when it is a re-challenge that follows a
failed verification (section 6). A proof MUST carry `tx` and `nonce`.

A parameter MUST NOT appear more than once in a header. A repeated parameter, a
missing required parameter, an unknown parameter, or any value that does not
match the grammar is a `malformed_request` (section 6). `nonce-val` and
`tx-hash` MUST be lowercase; an uppercase hexadecimal digit is a
`malformed_request`.

### 3.3 Canonical serialization

A parser MUST accept parameters in any order and with any `OWS`. A serializer
MUST emit the scheme name `Pulsar`, one space, then the parameters separated by
`", "` (comma then single space) in this fixed order:

    network, asset, amount, pay_to, nonce, expires[, error]

Every value is wrapped in double quotes. The `amount` is emitted in canonical
decimal form: no leading zeros in the integer part other than a single `0`, and
no trailing zeros in the fractional part and no trailing `.`. For example
`0.002`, `1`, `10.5`. Canonical serialization is what the `header-serialization`
vectors check; parsing tolerance is what the `header-parsing` vectors check.

## 4. Nonce

A nonce is a single-use, expiring token that binds one payment to one challenge.

Generation. A provider MUST draw at least 16 bytes (128 bits) from a
cryptographically secure random source per nonce and encode them as lowercase
hexadecimal. Nonces MUST be unpredictable; a counter or a timestamp is not a
nonce. A fresh challenge, including every re-challenge, MUST use a new nonce. A
nonce MUST NOT be reused across challenges.

Storage. For each issued nonce the provider MUST store the full requirement:
`asset`, `amount`, `pay_to`, and `expires`. Verification in section 6 reads
these stored values. Values a client places in a later header MUST NOT override
them.

Single use. A nonce is consumed the first time it verifies a payment
successfully. Consumption MUST be atomic with respect to concurrent requests: if
two requests present the same nonce, at most one may be marked used and served.
Once consumed, the nonce MUST fail as `nonce_used` forever after, or until it
expires and is evicted.

Expiry. `expires` is a Unix timestamp in seconds, UTC. The time-to-live SHOULD
be 300 seconds and MUST NOT exceed 3600 seconds. A verifier treats a nonce as
expired when `now > expires + SKEW`, where `SKEW` is a small clock-skew grace,
RECOMMENDED 5 seconds. `SKEW` widens the window only at the expiry boundary and
for no other check.

## 5. Memo derivation

The paying transaction MUST carry a `MEMO_HASH` memo equal to the SHA-256 digest
of the nonce:

    memo = SHA-256( nonce )

The input to SHA-256 is the US-ASCII bytes of the `nonce-val` string exactly as
it appears in the challenge, with no decoding and no trailing newline. The
result is 32 bytes and is placed in the transaction as a hash memo. On Horizon
this appears as `memo_type: "hash"` with `memo` holding the base64 of those 32
bytes.

The memo is what binds an on-chain payment to a specific challenge. A payment
with the correct destination, asset, and amount but the wrong memo MUST NOT
verify.

## 6. Verification

The verifier receives a proof (`tx`, `nonce`), loads the stored requirement for
that nonce, resolves the transaction on the network named by the requirement,
and reads the current time `now`. It applies the following checks in order and
returns on the first failure. Verification fails closed: any error, timeout, or
ambiguity returns a failure verdict and the resource is not served.

1. `malformed_request`: the proof or the stored challenge does not satisfy
   section 3.
2. `unknown_nonce`: the nonce is not in the provider's store (never issued, or
   already evicted).
3. `nonce_used`: the nonce is in the store but already consumed.
4. `nonce_expired`: `now > expires + SKEW`.
5. `tx_not_found`: no transaction with this hash is included on the network yet.
6. `tx_failed`: the transaction is included but its result is unsuccessful.
7. `memo_mismatch`: the transaction memo is not a hash memo, or its 32 bytes do
   not equal `SHA-256(nonce)`.
8. `wrong_destination`: no `payment` operation in the transaction pays `pay_to`.
9. `wrong_asset`: a `payment` operation pays `pay_to`, but none in the required
   asset.
10. `insufficient_amount`: the paid amount is less than the required amount.
11. `valid`: every check passed. The verifier MUST atomically mark the nonce
    used before the resource is served. If the atomic mark finds the nonce
    already used, the verdict becomes `nonce_used` and the resource is not
    served.

Amount accounting. Only `payment` operations are counted in v0.1. Path payments
(`path_payment_strict_send`, `path_payment_strict_receive`) are ignored. The
paid amount is the sum, in stroops, of the amounts of all `payment` operations
whose destination equals `pay_to` and whose asset equals the required asset.

Stroop conversion. To compare amounts, convert each decimal to an integer number
of stroops with exact fixed-point arithmetic: split on `.`, right-pad the
fractional part to 7 digits (rejecting more than 7), and compute
`int_part * 10^7 + frac_padded`. An implementation MUST NOT convert an amount
through an IEEE-754 binary float on any payment path.

### 6.1 HTTP behavior per verdict

`payment_required` is the code for the initial challenge sent when a request
arrives with no `Authorization: Pulsar` header. It is not a failure.

| verdict             | HTTP | re-challenge    | client should                                      |
| ------------------- | ---- | --------------- | -------------------------------------------------- |
| payment_required    | 402  | yes             | pay, then retry                                    |
| malformed_request   | 400  | no              | fix the request; do not pay                        |
| unknown_nonce       | 402  | yes (new nonce) | pay against the new challenge                      |
| nonce_used          | 402  | no              | stop; treat as terminal (a retry would double-pay) |
| nonce_expired       | 402  | yes (new nonce) | pay against the new challenge                      |
| tx_not_found        | 402  | no              | wait for inclusion, retry the same proof           |
| tx_failed           | 402  | no              | stop; the payment did not settle                   |
| memo_mismatch       | 402  | no              | stop; the payment is not bound to this nonce       |
| wrong_destination   | 402  | no              | stop                                               |
| wrong_asset         | 402  | no              | stop                                               |
| insufficient_amount | 402  | no              | stop; the client underpaid                         |
| valid               | 200  | no              | consume the response                               |

A re-challenge carries a fresh challenge and an `error` parameter naming the
verdict, and the response body SHOULD be
`{ "error": "<verdict>", "message": "<human-readable>" }`. On a non-re-challenge
failure the body SHOULD carry the same JSON shape without a new challenge. A
verifier MUST NOT auto-retry a `nonce_used` result: it means a payment was
already spent on this nonce and paying again would pay twice.

## 7. Error codes

The complete set of verdict codes:

    payment_required      Initial challenge; no proof was presented.
    malformed_request     A header failed the grammar or a required
                          parameter was missing or duplicated.
    unknown_nonce         The nonce was never issued or has been evicted.
    nonce_used            The nonce was already consumed.
    nonce_expired         now is past expires plus the skew grace.
    tx_not_found          The transaction is not yet included on-chain.
    tx_failed             The transaction is included but did not succeed.
    memo_mismatch         The memo is not SHA-256(nonce) as a hash memo.
    wrong_destination     No payment operation pays pay_to.
    wrong_asset           A payment pays pay_to but not in the required asset.
    insufficient_amount   The paid amount is below the required amount.
    valid                 The payment satisfies the requirement.

These codes are stable identifiers. An implementation MUST use them verbatim in
the `error` parameter and in conformance output. Adding, renaming, or removing a
code is a protocol change under `CONTRIBUTING.md`.

## 8. Worked example, real Testnet values

The values below come from a real transaction on the Stellar Testnet. The
example prices the call in native XLM so any reader can reproduce it with only
friendbot; a USDC challenge differs only in the `asset` value. Every byte is
exact.

Accounts (funded through friendbot):

    provider pay_to : GD4RJ43KGBZ3FNV4LCWZGYNPJQZPITK37QJYRCTF62LPY5S4LRETDAZW
    client payer    : GC42P4IFEUITU5VPDLIIK5VFDOD4L5LQJTG6SM5FJSVS5JXRC4HXWM5D

Challenge parameters:

    nonce   : 90aa9a441c48f8a68be1686f3ff7da1184bf7eaf9f721a0c0b675a0a33109225
    amount  : 0.002            (XLM; 20000 stroops)
    expires : 1789431692       (Unix seconds, UTC)

Memo derivation:

    memo = SHA-256("90aa9a441c48f8a68be1686f3ff7da1184bf7eaf9f721a0c0b675a0a33109225")
    memo (hex)    : ae9f868000c0c559ee2aca50de28b0079d439f03f2608d7d770653fb48bed5cc
    memo (base64) : rp+GgADAxVnuKspQ3iiwB51DnwPyYI19dwZT+0i+1cw=

Step 1, the unpaid request and the 402 (header shown wrapped for width; it is a
single header line):

    GET /tools/summarize HTTP/1.1
    Host: api.example.com

    HTTP/1.1 402 Payment Required
    WWW-Authenticate: Pulsar network="stellar:testnet", asset="XLM",
      amount="0.002",
      pay_to="GD4RJ43KGBZ3FNV4LCWZGYNPJQZPITK37QJYRCTF62LPY5S4LRETDAZW",
      nonce="90aa9a441c48f8a68be1686f3ff7da1184bf7eaf9f721a0c0b675a0a33109225",
      expires="1789431692"
    Content-Type: application/json

    { "error": "payment_required" }

Step 2, the client submits a Stellar payment of 20000 stroops of XLM to `pay_to`
with the hash memo above. The resulting transaction, resolvable on Horizon
Testnet, is:

    tx_hash    : d2fbddbda7e4236db8f0b85855c0fcc81f6c215dbe594f8bf6736341c032400d
    ledger     : 4681597
    created_at : 2026-09-15T00:19:32Z
    memo_type  : hash
    memo       : rp+GgADAxVnuKspQ3iiwB51DnwPyYI19dwZT+0i+1cw=
    successful : true

Confirm it directly:

    https://horizon-testnet.stellar.org/transactions/d2fbddbda7e4236db8f0b85855c0fcc81f6c215dbe594f8bf6736341c032400d

Step 3, the client retries with the proof:

    GET /tools/summarize HTTP/1.1
    Host: api.example.com
    Authorization: Pulsar
      tx="d2fbddbda7e4236db8f0b85855c0fcc81f6c215dbe594f8bf6736341c032400d",
      nonce="90aa9a441c48f8a68be1686f3ff7da1184bf7eaf9f721a0c0b675a0a33109225"

    HTTP/1.1 200 OK
    Content-Type: application/json

    { "summary": "..." }

The verifier runs section 6 against the stored requirement (asset `XLM`, amount
`0.002`, `pay_to` as above), resolves the transaction, confirms the memo equals
`SHA-256(nonce)`, confirms 20000 paid stroops meet 20000 required stroops, marks
the nonce used, and serves the response. A second request with the same nonce
returns `nonce_used`.

## 9. Conformance

An implementation is conformant when, for every vector in `../conformance/`, its
runner produces the expected result. The vectors cover header serialization,
header parsing, nonce validation, and verification verdicts. See
`../conformance/README.md` for the runner contract.
