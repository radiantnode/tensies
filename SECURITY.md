# Security Policy

Tensies is a hobby project, maintained in spare time. There's no security team
and no support contract — but I do care about it, and I'll look into anything you
report. The notes below set realistic expectations rather than promises.

## Supported Versions

Tensies is continuously deployed from `main`. There's no release train to pin
to: the running service is always built from the latest commit, and any fix
lands there and ships with the next deploy. Older commits and forks don't get
backported fixes.

| Version              | Supported          |
| -------------------- | ------------------ |
| `main` (latest)      | :white_check_mark: |
| Anything older       | :x:                |
| Forks / self-hosted  | :x:                |

If you self-host, run the latest `main` — older checkouts may be missing the
abuse caps, origin allowlist, and security headers, and I can't support those.

## Reporting a Vulnerability

**Please don't open a public GitHub issue for security problems** — a public
report tips off attackers before there's a fix. Instead, report it privately:

- **GitHub Security Advisories** (preferred) — the
  [Security tab](https://github.com/radiantnode/tensies/security/advisories)
  → **Report a vulnerability**.
- **Email** — michael@simmonstx.com, subject starting with `[Tensies Security]`.

It helps a lot if you can include what's affected (e.g. the `/ws` handler, an
HTTP route, the Redis game store), how to reproduce it, and what the impact is.

### What to expect

This is a side project, so please be patient — I read reports when I can, not on
a clock:

- I'll try to acknowledge your report within a week or so.
- If I can reproduce it and agree it's a real issue, I'll fix it on `main` and
  deploy. Timeline depends on severity and on how much free time I have.
- If I don't think it's a vulnerability, I'll tell you why (often it's behaviour
  controlled by a documented config knob — see below).
- I'm happy to credit you in the fix or advisory unless you'd rather stay
  anonymous.

Please give me a reasonable chance to ship a fix before disclosing publicly.

### Good to know

Some of the hardening in Tensies is **configuration-driven**, so what you see on
a given deployment may be the operator's choice rather than a bug:

- WS origin enforcement (`ALLOWED_ORIGINS`), message-size and connection caps
  (`MAX_WS_MESSAGE_BYTES`, `MAX_CONNECTIONS_PER_IP`), create/join rate limits.
- Bearer-gating on `/metrics` and `/stats` (`METRICS_TOKEN` / `STATS_TOKEN`).
- Security headers — CSP and HSTS — in `server/security.py`.
- Proxy / `X-Forwarded-For` trust (`TRUST_PROXY_HEADERS`, `TRUSTED_PROXY_HOPS`).

A way to bypass one of those when it's correctly configured, or an unsafe
default out of the box, is exactly the kind of thing worth reporting.
