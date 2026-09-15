## What and why

Describe the change and the problem it solves. Link the issue it closes.

## Checklist

- [ ] The change is a single logical step with a Conventional Commit message.
- [ ] `node tools/validate.mjs` passes.
- [ ] `prettier --check` passes.
- [ ] Any conformance vector change is paired with the normative change it reflects.
- [ ] A change near replay, amounts, or verification order adds or updates a vector.
- [ ] No secret keys, and no mainnet configuration, are introduced.
- [ ] The dependency direction is intact: this repository references no implementation.
- [ ] A dependent pull request in pulsar-js or pulsar-facilitator is linked below.

## Linked pull requests

List any dependent pull request in another repository, or write "none".
