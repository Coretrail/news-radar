# Docker Compose

[Português](../pt/docker.md) · [Documentation](README.md)

Use a new checkout and a fresh database volume. Requirements: Git, Node.js 24+ for the environment helper, Docker Engine and the Docker Compose plugin (2.20 or newer). The optional translation profile also needs Python 3 for model provisioning and enough storage and memory for its models.

## First start

```sh
git clone <YOUR-REPOSITORY-URL> news-radar
cd news-radar
node scripts/init-env.mjs
```

Review `.env`. Keep `APP_URL=http://localhost:8080` for the default local deployment. Choose `SEED_SOURCES=minimal`, `none` or `all` before initializing the database; see [sources](sources.md). The initializer generates separate `PGPASSWORD` and `PGADMIN_PASSWORD` secrets only when creating a new `.env`. It does not rotate existing database passwords. Compose keeps bootstrap superuser `radar_admin` and its password in the `db` service. The database initialization script creates the application role `PGUSER` as a non-superuser database owner; migrations and application services use that role.

```sh
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
docker compose logs --tail=100 init api collector web
```

The `init` service applies migrations and initial data, then exits. An exited `init` with exit code 0 is expected. `api` and `collector` use PostgreSQL; `web` serves the built frontend and proxies API requests and live updates. PostgreSQL is internal to the Compose network. The web port binds to host loopback by default.

Open http://localhost:8080. First collection can take time; an empty dashboard is expected with `SEED_SOURCES=none`, disabled sources or upstream failures.

```sh
docker compose exec api node build/admin-cli.js
```

Open the printed setup URL within 15 minutes and choose administrator credentials. Treat that URL as a password. It is for first-time account creation; an existing administrator does not get replaced by rerunning it.

## Multiple independent installations

Use a separate checkout and `.env` for each instance. Set a unique `COMPOSE_PROJECT_NAME`, choose an unused `HTTP_PORT`, and allocate non-overlapping `COMPOSE_SUBNET`/`PROXY_ADDRESS` values. Set each `APP_URL` accordingly and generate independent database secrets. Project names isolate Compose volumes and services; sharing a name can unintentionally reuse another installation's resources.

## Remote access

For a remote host, an SSH tunnel preserves the loopback binding:

```sh
ssh -L 8080:127.0.0.1:8080 <USER>@<HOST>
```

Then use http://localhost:8080 in your browser. For shared access, configure the bind address and allowed client networks deliberately, and place an operator-managed TLS proxy in front. See [security](security.md) before changing either network boundary. A public reading dashboard does not acquire authentication from the administrator login.

## Stop, update and inspect

```sh
docker compose logs --tail=100 api collector
docker compose stop
docker compose up -d
```

Before an update, take and verify a backup, read `CHANGELOG.md`, review `.env.example` for new settings, and obtain the desired release in your checkout. Then rebuild:

```sh
docker compose up -d --build --wait --wait-timeout 180
docker compose ps
```

Migration rollback is not automatic. Keep the previous release and a tested database backup when you need a recovery path. `docker compose down` preserves named volumes; **`docker compose down -v` deletes them**, including the database.

## Backup and restore

With the default database names:

```sh
mkdir -p backups
chmod 700 backups
docker compose exec -T db pg_dump -U newsradar -d newsradar -Fc > backups/newsradar.dump
chmod 600 backups/newsradar.dump
pg_restore --list backups/newsradar.dump
```

Adjust `-U` and `-d` if you changed `PGUSER` or `PGDATABASE`. `pg_restore --list` needs a compatible PostgreSQL client; it inspects the archive, not the completeness of a restore. Verify recovery in a separate disposable database before relying on a backup. Keep `.env` and deployment configuration separately in encrypted storage; never commit backups.

To restore, first create a separate fresh target database in a separate installation. Pipe the archive to its `pg_restore`, adjusting connection names:

```sh
docker compose exec -T db pg_restore -U newsradar -d newsradar --no-owner --exit-on-error < backups/newsradar.dump
```

This example assumes the target database is empty and initialization has not created application tables. Stop the target application's writers during restoration, check the restored data, then start the matching application version. Do not paste this command into a running production stack.

## Troubleshooting

Check `docker compose ps`, the `init` exit status and service logs. Changing `PGPASSWORD` or `PGADMIN_PASSWORD` in `.env` does not change the corresponding role password in an existing PostgreSQL volume: update that role through PostgreSQL administration and then recreate dependent services. The bootstrap application-role script runs only for an empty PostgreSQL data directory. Avoid removing volumes to solve connection errors. For translations, follow the separate [translation guide](translation.md).

[Default-profile validation results and limits](validation.md).
