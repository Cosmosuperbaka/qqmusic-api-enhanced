# Contributing

## Requirements

- Bun 1.4.2 (the repository uses `bun.lock`)
- Node.js 20+ if you want to smoke-test the Node entry
- No real QQ Music account is needed for the test suite; tests use mocks

## Setup

```bash
bun install --frozen-lockfile
bun run build
bun test
```

`bun run build` compiles the TypeScript sources and writes the `.js` / `.d.ts`
artifacts that are committed to the repository. Run it and commit the generated
files together with any TypeScript change.

## Rules

- Never commit real cookies, `qm_keyst`, `refresh_token`, AppSecret, account
  details, or unredacted logs. Tests must stay offline and use mocks.
- Keep new code compatible with Node.js 20+ and Bun. Avoid Bun-only APIs in the
  published runtime.
- New third-party code must use a permissive license compatible with this
  package. Add the SPDX header, update `THIRD_PARTY_NOTICES.md`, and ship the
  license text under `LICENSES/`. Do not add GPL/AGPL code to this MIT package.
- Do not use `eval`, dynamic `Function`, or unnecessary install scripts.
- Prefer small, focused changes. Add a mock test for any changed API behavior.
- Commit messages: `fix:`, `feat:`, `refactor:`, `docs:`, `ci:`, `chore:`.

## Release

1. Update `package.json` `version`.
2. Commit and push `main`.
3. Create and push a tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.

The tag triggers two workflows:

- `publish.yml` publishes the canonical package to npmjs via npm Trusted
  Publishing (no `NPM_TOKEN` / OTP).
- `publish-github-packages.yml` publishes the scoped mirror
  `@cosmosuperbaka/qqmusic-api-enhanced` to GitHub Packages.

Do not run `npm publish` locally; the workflows are the release path.

## Security

Report vulnerabilities through GitHub Security Advisories, not public issues.
See `SECURITY.md`.
