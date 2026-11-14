# Native Debian 13 / LXC installation

[Português](../pt/native-install.md) · [Documentation](README.md)

These instructions describe a **new, isolated deployment**, using `/srv/news-radar` as an example. They do not upgrade or reuse an existing host's database or service configuration. The template renderer only writes files into your chosen output directory; it does not install services automatically.

Use Debian 13 with systemd, PostgreSQL 17, nginx, Git and Node.js 24+. In LXC, use a container with working systemd, DNS, outbound HTTPS, enough disk/memory and a reachable package repository. Native installation does not require nested Docker. Choose the container's network access and backup strategy separately.

Commands prefixed with `sudo` require an administrator; omit `sudo` in a root shell. Replace paths and names consistently if you choose different values.

## Prepare the host

```sh
sudo apt update
sudo apt install git ca-certificates build-essential postgresql-17 postgresql-client-17 nginx
node --version
command -v node
```

Install Node.js 24+ using your preferred maintained distribution method if it is absent or older. Verify the actual binary path; Debian installations commonly use `/usr/bin/node`, but version managers may use another path. A systemd service needs an absolute path available without your interactive shell setup.

Create a dedicated user and installation directory:

```sh
sudo useradd --system --user-group --home-dir /srv/news-radar --shell /usr/sbin/nologin newsradar
sudo install -d -o newsradar -g newsradar -m 755 /srv/news-radar
sudo -u newsradar git clone <YOUR-REPOSITORY-URL> /srv/news-radar
```

Create a fresh PostgreSQL role and database:

```sh
sudo -u postgres createuser --no-superuser --no-createdb --no-createrole newsradar
sudo -u postgres createdb --owner=newsradar newsradar
```

This example uses Unix socket peer authentication: the `newsradar` operating-system user connects as the matching PostgreSQL role. Confirm your `pg_hba.conf` policy permits that local connection; do not change it to unrestricted trust. For TCP or a separate database host, configure a strong role password and restricted authentication/network rules instead.

## Build and initialize

Open a shell as the service user explicitly, then run the following inside it:

```sh
sudo -u newsradar -H /bin/bash
cd /srv/news-radar
node scripts/init-env.mjs
```

Edit `.env` as this user. For this example, confirm:

```dotenv
APP_URL=http://localhost:8080
HOST=127.0.0.1
PORT=3001
PGHOST=/var/run/postgresql
PGPORT=5432
PGDATABASE=newsradar
PGUSER=newsradar
TRUST_PROXY=127.0.0.1,::1
NATIVE_INSTALL_DIR=/srv/news-radar
NATIVE_USER=newsradar
NATIVE_GROUP=newsradar
NODE_BINARY=/usr/bin/node
NATIVE_SERVER_NAME=localhost
NATIVE_LISTEN=127.0.0.1:8080
```

The generated `PGPASSWORD` and Compose-only `PGADMIN_PASSWORD` are unused by this native peer-authentication example; retain a private `.env` with mode `600` and do not publish it. The application directory is traversable so nginx can read public assets in `dist/`; secrets must remain in private files. Choose `SEED_SOURCES` and local-region settings before seeding. Review `ALLOWED_NETWORKS` for your actual client path. Application commands load `.env` from their working directory.

```sh
npm ci
npm run build
npm run migrate
npm run seed
node scripts/render-native.mjs --output ./native-generated
```

Read every rendered file, especially service identities, executable paths, filesystem paths, nginx listener, allowed networks and proxy settings. Output can contain deployment details; do not commit it. Leave the service-user shell:

```sh
exit
```

## Install the reviewed configuration

Install the API and collector units and nginx configuration from `native-generated`, using the output filenames supplied by the renderer. Keep a copy of any existing nginx configuration before choosing a site filename. With this template's names:

```sh
sudo install -m 644 /srv/news-radar/native-generated/news-radar-api.service /etc/systemd/system/news-radar-api.service
sudo install -m 644 /srv/news-radar/native-generated/news-radar-collector.service /etc/systemd/system/news-radar-collector.service
sudo install -m 644 /srv/news-radar/native-generated/news-radar.conf /etc/nginx/sites-available/news-radar.conf
sudo ln -s /etc/nginx/sites-available/news-radar.conf /etc/nginx/sites-enabled/news-radar.conf
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now news-radar-api news-radar-collector
sudo systemctl reload nginx
```

If the symlink already exists, review its target rather than overwriting it blindly. Do not install the optional translation service until its [models and Python environment](translation.md) are ready.

Check operation and create the administrator:

```sh
sudo systemctl status news-radar-api news-radar-collector --no-pager
sudo journalctl -u news-radar-api -u news-radar-collector -n 100 --no-pager
sudo -u newsradar -H /bin/bash
cd /srv/news-radar
npm run admin:setup
exit
```

Open http://localhost:8080 directly or through the SSH tunnel described in the [Docker guide](docker.md#remote-access). The one-time setup URL is secret and expires in 15 minutes. Set `APP_URL` to the actual browser-facing origin if it differs.

## Maintenance and backups

Before updating, take and test a PostgreSQL backup and save deployment configuration securely. In the application directory, obtain the selected release, run `npm ci` and `npm run build`, stop writers before migrations if required by that release, run migrations as the service user, then restart the affected services. Re-render and review templates when environment or template settings change.

For a native archive using the example's socket peer authentication:

```sh
sudo install -d -o newsradar -g newsradar -m 700 /var/backups/news-radar
sudo -u newsradar /bin/bash
cd /srv/news-radar
BACKUP_DIR=/var/backups/news-radar node scripts/backup.mjs
exit
```

The helper creates a timestamped custom-format dump with restrictive permissions and removes incomplete output on failure. Inspect an archive with `pg_restore --list <DUMP-PATH>`, then verify a restore into a fresh, separate database. Archive inspection alone does not test recovery. Retain multiple generations through your backup policy. Keep encrypted backups outside the host/container and include `.env` and any operator-managed TLS/proxy configuration separately. See [security](security.md) before widening access.

## Administrator recovery

Only an authorized host operator should perform this procedure. It revokes **all** administrator accounts and sessions. Back up the database first, confirm the target deployment and pause administrative access while recovering. The reading dashboard does not grant this permission.

Using the example native service identity and database, run:

```sh
sudo -u newsradar psql --dbname newsradar --set=ON_ERROR_STOP=1 --command='BEGIN; DELETE FROM sessions; DELETE FROM admins; DELETE FROM bootstrap; COMMIT;'
sudo -u newsradar -H /bin/bash
cd /srv/news-radar
npm run admin:setup
exit
```

Adjust the role/database/path to the reviewed deployment. Open the newly generated one-time URL privately and define new credentials. Do not reuse a suspected exposed password or share the bootstrap URL. This operation does not rotate a separate operating-system or database password.
