# Security Policy

## Supported Versions

This project is currently maintained on:
- `main` (latest)
- `v0.2.x` (best-effort)

## Reporting a Vulnerability

If you discover a security issue, do not open a public issue first.

Please report privately with:
1. Vulnerability type and impact
2. Reproduction steps
3. Affected files/endpoints
4. Suggested mitigation (optional)

Contact channel (temporary):
- Open a private communication with repository maintainers via GitHub profile contact.

## Scope Highlights

Security-sensitive areas in this repository:
- Authentication/authorization (`JWT`, `RBAC`)
- Webhook signature validation (`HMAC`, anti-replay)
- WhatsApp session/auth lifecycle
- Environment secrets handling (`.env`)
- Automated status mutations (idempotent operations)

## Best Practices for Operators

- Never commit `.env` files or credentials
- Rotate secrets periodically (`JWT_SECRET`, webhook secrets)
- Restrict host exposure (local/private network by default)
- Review audit logs regularly
- Apply updates and rerun `e2e-go-no-go.ps1` after changes

## Disclosure Process

1. Acknowledge report
2. Reproduce and assess severity
3. Patch and validate
4. Publish remediation notes
5. Credit reporter (if desired)
