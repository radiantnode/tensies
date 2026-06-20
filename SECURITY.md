# Security Policy

## Supported Versions

Tensies is a continuously deployed, real-time multiplayer web app rather than a
versioned download. There is no release train to pin to: the running service is
always built from the latest `main`, and security fixes land there and roll out
with the next deploy. We don't backport fixes to old commits.

If you self-host, only the current `main` is supported. Older checkouts may be
missing the abuse caps, origin allowlist, and security headers described below,
so treat anything behind `main` as unsupported.

| Version            | Supported          |
| ------------------ | ------------------ |
| `main` (latest)    | :white_check_mark: |
| Tagged releases    | :white_check_mark: (latest only) |
| Older `main` / forks | :x:              |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security problems.** A public
report tips off attackers before a fix is out.

Instead, report privately through one of:

- **GitHub Security Advisories** — the preferred channel. Go to the
  [Security tab](https://github.com/radiantnode/tensies/security/advisories)
  of the repository and choose **Report a vulnerability**. This opens a private
  thread with the maintainers.
- **Email** — michael@simmonstx.com. Use a subject line starting with
  `[Tensies Security]`.

### What to include

A good report lets us reproduce the issue quickly. Where you can, please share:

- The component or endpoint affected (e.g. the `/ws` WebSocket handler, an HTTP
  route, the Redis-backed game store).
- Steps to reproduce, a proof-of-concept, or the exact request/message that
  triggers it.
- The impact you think it has (data exposure, game-state tampering, denial of
  service, etc.) and any deployment assumptions you made.

### What to expect

- **Acknowledgement within 3 business days** that we've received your report.
- **A triage assessment within 7 business days** — whether we can reproduce it,
  how severe we rate it, and whether we're accepting it.
- **Regular updates** (at least weekly) while we work on a fix.
- **If accepted:** we'll develop and ship a fix on `main`, deploy it, and credit
  you in the advisory unless you'd rather stay anonymous. For higher-severity
  issues we may publish a GitHub Security Advisory once the fix is live.
- **If declined:** we'll explain why we don't consider it a vulnerability (for
  example, behaviour that's already governed by a documented config knob) so you
  have the reasoning, not just a "no."

### Scope notes

Some hardening in Tensies is intentionally **configuration-driven**, so behaviour
you observe on a given deployment may be the operator's choice rather than a bug:

- WebSocket origin enforcement (`ALLOWED_ORIGINS`), message-size and connection
  caps (`MAX_WS_MESSAGE_BYTES`, `MAX_CONNECTIONS_PER_IP`), and create/join rate
  limits.
- Bearer-gating on `/metrics` and `/stats` (`METRICS_TOKEN` / `STATS_TOKEN`).
- Security response headers — CSP and the HSTS group — in `server/security.py`.
- Proxy / `X-Forwarded-For` trust (`TRUST_PROXY_HEADERS`, `TRUSTED_PROXY_HOPS`),
  which the per-IP caps depend on behind a load balancer.

If you've found a way to bypass one of these when it's correctly configured —
or a default that's unsafe out of the box — that's in scope and we'd like to
hear about it.

Please give us a reasonable window to ship a fix before disclosing publicly. We
aim to resolve and deploy fixes well within 90 days and will keep you posted on
progress.
