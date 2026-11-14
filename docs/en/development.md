# Development and verification

[Português](../pt/development.md) · [Documentation](README.md) · [Contributing](../../CONTRIBUTING.md)

Use Node.js 24+, npm and PostgreSQL 17. Work with your own fresh development database. The application reads `.env` from the current directory; test processes must use their dedicated test settings. Never point development or integration checks at a production database.

## Architecture

| Path | Responsibility |
| --- | --- |
| `web/` | React interface, story presentation and administration |
| `server/app.ts`, `server/main.ts` | Fastify routes, authentication and API startup |
| `server/collector.ts`, `server/connectors.ts`, `server/jetstream.ts` | Polling and opt-in streaming collection |
| `server/domain.ts`, `server/ingest.ts` | Classification, normalization and persistence |
| `server/safe-fetch.ts` | Restricted upstream requests |
| `server/migrations/` | Database migrations |
| `server/translation/`, `server/translation-worker.ts` | Optional local translation and queue |
| `deploy/`, `scripts/` | Deployment templates and portable setup helpers |
| `tests/` | Unit, database, browser and optional live-source checks |

The frontend build is written to `dist/`; compiled server files go to `build/`. The Vite development server proxies `/api` to `127.0.0.1:3001`. Run the collector separately when you need actual collection; tests and fixtures should not depend on live publisher availability.

## Local development

Create `.env`, configure your fresh development database and initialize it using the [native guide](native-install.md) or an isolated PostgreSQL instance. Then:

```sh
npm ci
npm run migrate
npm run seed
npm run api
```

In separate terminals, from the same application directory:

```sh
npm run dev
```

```sh
npm run collector
```

Use the local URL reported by Vite for development. Keep the API port aligned with `vite.config.ts`. For administrator setup, configure `APP_URL` for the browser origin you are using before `npm run admin:setup`.

## Checks

```sh
npm test
npm run build
```

Database-backed checks require a **separate database named `newsradar_test`**, accessible by the configured test role. For the native example, create it as a PostgreSQL administrator:

```sh
sudo -u postgres createdb --owner=newsradar newsradar_test
```

For the native peer-authentication example, open a shell as the matching operating-system user first; setting `PGUSER` alone does not change your system identity:

```sh
sudo -u newsradar -H /bin/bash
cd /srv/news-radar
```

Run initialization and checks inside that shell, explicitly choosing the socket, role and test database:

```sh
NODE_ENV=test DATABASE_URL= PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=newsradar PGDATABASE=newsradar_test npm run migrate
NODE_ENV=test DATABASE_URL= PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=newsradar PGDATABASE=newsradar_test SEED_SOURCES=none npm run seed
NODE_ENV=test DATABASE_URL= PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=newsradar PGDATABASE=newsradar_test npm run test:integration
```

Leave the service-user shell with `exit` when finished. For a separate TCP test server, use its explicit `PGHOST`, `PGPORT`, `PGUSER` and test-only authentication instead. `NODE_ENV=test` skips loading `.env`, so supply the test connection variables explicitly. Test commands must never inherit production connection strings. See `package.json` for the exact commands and optional translation checks.

Browser checks need a compatible local Chromium executable and an isolated running web application with controlled fixture stories. Use the portable test URL explicitly:

```sh
NODE_ENV=test DATABASE_URL= PGHOST=/var/run/postgresql PGPORT=5432 PGUSER=newsradar PGDATABASE=newsradar_test TEST_URL=http://localhost:8080 npm run test:browser
```

For database-aware checks using native peer authentication, use the same `newsradar` operating-system identity as above. Setting `TEST_URL` does not change which database the running application uses; start that application with its own explicit isolated test configuration. Review each browser/admin/live script's prerequisites before running it. Some checks intentionally create data or change settings. Optional live-source checks depend on network/provider availability and are not offline unit tests. A check passing locally is evidence for that environment and revision, not a guarantee about every deployment.

## Documentation and fixtures

Update English and Portuguese guides together when changing commands or behaviour. Keep interface copy consistent with the Portuguese-first UI. Screenshots in `docs/screenshots/` must use clearly labelled illustrative demo stories and contain no operational usernames, private addresses, secrets or publisher text copied without permission.

Use reserved example domains, synthetic identities and a fresh local database for reproduction cases. Do not copy logs, database exports or Git history from a private deployment into a contribution.
