# Security Policy

## Supported scope

This repository is intended to run as a local developer tool.

- The MCP server is the primary supported interface.
- The companion API is localhost-bound by default and should stay that way unless you intentionally override `HOST`.
- The companion API only allows localhost-style CORS origins by default. Expanding `REPLICATOR_ALLOWED_ORIGINS` is an explicit trust decision.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub private vulnerability reporting if it is enabled for this repository. If private reporting is not available, contact the repository owner through the GitHub profile that published this repository before sharing details publicly.

Include:

- the affected component or path
- the impact you observed
- exact reproduction steps
- any suggested mitigation or patch, if you have one

## What to expect

- Acknowledgement should happen within a reasonable time after the report is seen.
- Reports will be validated before a fix or advisory is published.
- Please avoid public disclosure until the maintainer has had time to assess and ship a fix.

## Safe defaults for contributors

- Do not widen network exposure or CORS defaults without a strong reason and matching documentation.
- Do not commit secrets, tokens, or merchant data.
- Keep generated artifacts and test fixtures free of real credentials.
- Prefer least-privilege local defaults for any new surface.
