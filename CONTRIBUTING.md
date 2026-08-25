# Contributing

Contributions are welcome for executor adapters, verifiers, Business Effect Contracts, policy packs, tests, documentation, and control-plane features.

## Development principles

- Keep the core transaction model vendor-neutral.
- Do not treat an LLM as an authorization mechanism.
- Preserve explicit uncertain states.
- Add tests for failure-before-effect and failure-after-effect paths.
- Never add plaintext credentials to fixtures.

Run:

```bash
npm run test
npm run validate
```

before opening a pull request.
