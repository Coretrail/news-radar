# Security and deployment

[Português](../pt/security.md) · [Documentation](README.md) · [Vulnerability reporting](../../SECURITY.md)

The reader is unauthenticated. Administrator authentication protects administration, not the feed, search, story contents or other reader endpoints. Use the template on a trusted local machine/network unless you have assessed and configured the whole deployment for wider access.

## Access and TLS

Keep PostgreSQL private and expose only the web entry point. Default Compose and native examples listen on `127.0.0.1:8080`. A firewall and explicit nginx client allow list are useful when extending access beyond loopback. Do not assume Docker-published ports inherit all host firewall policies.

For HTTPS, terminate TLS at an operator-managed reverse proxy and forward to the loopback web listener. Set `APP_URL` to the final HTTPS origin. Preserve the original host and scheme, and support the live update connection. Scope trust to the actual proxy addresses/CIDRs. Review nginx's effective client address and allow list when introducing a proxy; otherwise its own address can mask all clients.

The template does not provision a domain, certificates, a tunnel or an Internet-facing authentication gateway. If readers need authentication, add an access gateway at the deployment boundary and verify both pages and API/live endpoints through it. Test administrator login and session cookies through the final HTTPS URL.

## Secrets and accounts

- Keep `.env`, database dumps, model caches, logs and generated deployment files out of version control.
- The administrator setup link is a one-time secret valid for 15 minutes. Generate it on the intended instance and open it only through your trusted path.
- Use a unique administrator password. Protect database administration access and encrypted backups with the same care.
- Changing `PGPASSWORD` or Compose bootstrap `PGADMIN_PASSWORD` in `.env` does not rotate the corresponding PostgreSQL role password. Coordinate the database change with service configuration and restart dependent processes.
- If a credential reaches a public repository, revoke/rotate it. Removing the file from the latest commit is insufficient.

No default administrator password or operational database is distributed. The application runs with a dedicated database role and should run under a dedicated service user in native deployments.

## Untrusted content and integrations

Treat all feeds, titles, summaries and URLs as untrusted inputs. Review new connectors for HTML handling, URL validation, private-network requests, redirects, response limits and provider authentication. Do not weaken fetch restrictions just to make an unavailable source work. Store only the content needed for your use case and retain publisher attribution and original links.

Urgency labels are automated classifications, not authoritative emergency alerts. Automatic translations can be wrong. Follow original official sources for time-sensitive, safety-related or other consequential decisions.

## Routine maintenance

Patch the host and runtime, review dependency and image updates, inspect failed collection/translation jobs and periodically test backup recovery. Review who can reach `/admin` and the reading API after network changes. Do not expose logs or health/debug information containing secrets.

When requesting support, provide versions and redacted reproduction steps. Exclude setup URLs, session cookies, passwords, private hostnames/IPs, private source URLs and real user data. Report vulnerabilities privately as described in [SECURITY.md](../../SECURITY.md).
