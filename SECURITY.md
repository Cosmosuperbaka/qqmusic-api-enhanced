# Security Policy

## Supported versions

Only the latest published 1.x release receives security fixes.

## Reporting a vulnerability

Please use GitHub Security Advisories:

https://github.com/Cosmosuperbaka/qqmusic-api-enhanced/security/advisories/new

Do **not** open a public issue for a vulnerability. Do not include real cookies,
`qm_keyst`, `refresh_token`, AppSecret, account details, or unredacted logs in a
report. If a credential may have leaked, rotate it first.

## In scope

- Cookie / token / credential leakage, logging, or insecure storage in this package
- Authentication, session refresh, or QR login logic flaws in this package
- Remote code execution, unsafe parsing, path traversal, or injection
- Supply-chain or dependency compromise affecting this package
- License / provenance problems in the published artifact

## Out of scope

- Upstream QQ Music API changes, outages, rate limits, or account risk control
- Account bans, ToS disputes, or legal issues caused by using the package
- Vulnerabilities that require the attacker to already control the user's machine

Upstream behavior can still be reported as a normal bug, as long as no credentials
are included.
