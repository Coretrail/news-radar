# Configuration

[Português](../pt/configuration.md) · [Documentation](README.md)

Run `node scripts/init-env.mjs` to create `.env` from `.env.example`. It generates independent application and database-administrator passwords and leaves an existing `.env` unchanged. Keep the real file private. The example file is the authoritative list of supported settings; use it when upgrading.

| Setting | Meaning |
| --- | --- |
| `APP_URL` | Browser-facing origin, including scheme and port; default `http://localhost:8080`. Used in setup URLs. |
| `HOST`, `PORT` | API bind address and port. Native default: `127.0.0.1:3001`; Docker services bind inside their container. |
| `PGHOST`, `PGPORT` | PostgreSQL host/socket directory and port. Compose uses `db:5432`; native installations can use `/var/run/postgresql`. |
| `PGDATABASE`, `PGUSER`, `PGPASSWORD` | Application database, non-superuser role and secret. Default database and role: `newsradar`. |
| `PGADMIN_PASSWORD` | Separate Compose bootstrap password for PostgreSQL superuser `radar_admin`; passed only to `db`, never to application services. Unused by the native peer-authentication example. |
| `DATABASE_URL` | Optional native connection string; leave empty when using separate `PG*` settings. Never share URLs containing credentials. |
| `TRUST_PROXY` | Explicit proxy IPs/CIDRs; `.env.example` trusts native loopback nginx (`127.0.0.1,::1`). `false` means no trusted proxy. Compose sets this to `PROXY_ADDRESS`. Trust-all is rejected. |
| `COMPOSE_PROJECT_NAME` | Compose project identity; default `news-radar`. Choose a unique name for each concurrent installation. |
| `HTTP_BIND`, `HTTP_PORT` | Compose host listener; default `127.0.0.1:8080`. |
| `COMPOSE_SUBNET`, `PROXY_ADDRESS` | Compose network and web proxy address; defaults `172.30.240.0/24` and `172.30.240.10`. Change both consistently if they conflict with an existing network. |
| `ALLOWED_NETWORKS` | Space-separated client IP/CIDR allow list rendered into nginx. Default `all` relies on the loopback listener; narrow it before LAN exposure. |
| `APP_TIMEZONE` | Display time zone; default `Europe/Lisbon`. Use an IANA time zone identifier. |
| `LOCAL_REGION_NAME` | Human-readable local category name; default `Notícias locais`. |
| `LOCAL_REGION_KEYWORDS` | Optional comma-separated local classification keywords. Empty means no region-specific keywords. |
| `LOCAL_CATEGORY_ID` | Local category identifier; default `local`. Choose before first seed. |
| `SEED_SOURCES` | `minimal` (default), `none`, or `all`; see [source policy](sources.md). |
| `TRANSLATION_ENABLED` | `false` by default; enables the optional translation feature. Review the administrative setting too. |
| `TRANSLATION_PYTHON`, `TRANSLATION_MODELS` | Native Python executable and model directory; use absolute paths for native services. Compose supplies container paths. |
| `COMPOSE_PROFILES` | Empty by default. Set to `translation` only after provisioning optional models. |
| `NATIVE_INSTALL_DIR` | Native application directory; example/default `/srv/news-radar`. |
| `NATIVE_USER`, `NATIVE_GROUP` | Dedicated service identity; default `newsradar`. |
| `NODE_BINARY` | Absolute Node.js executable path used by native services; default `/usr/bin/node`. Verify yours. |
| `NATIVE_SERVER_NAME` | nginx server name for native templates; default `localhost`. |
| `NATIVE_LISTEN` | nginx listen address/port; default `127.0.0.1:8080`. |

Source configuration, monitored accounts, classification rules and translation settings are also managed through `/admin`. The initial translation preference is recorded once; later initialization preserves an administrator's choice. Setting `TRANSLATION_ENABLED=true` and starting a worker after the first installation also requires enabling translation under Administration → System. Seed settings initialize a fresh database; they do not promise to rename, remove or reconfigure records already administered in an existing database.

## Local region

Set your own labels before first initialization, for example:

```dotenv
APP_TIMEZONE=Europe/Lisbon
LOCAL_REGION_NAME="My region"
LOCAL_REGION_KEYWORDS="Example Town,Example Valley"
LOCAL_CATEGORY_ID=local
```

The template does not assume the operator's municipality, domain or private network. Test your keywords against representative stories to avoid broad false matches. Changing `LOCAL_CATEGORY_ID` after initial setup requires reviewing existing category references.

## Network boundaries

The web listener, nginx client allow list and Fastify proxy trust are different settings. A loopback host binding limits which machines can connect. `ALLOWED_NETWORKS` controls nginx clients. `TRUST_PROXY` determines which proxies may supply client address information to the API; it does not grant access by itself.

For Docker, the API trusts the web proxy at `PROXY_ADDRESS` only. Change that address and `COMPOSE_SUBNET` consistently if the default subnet collides. Docker NAT may alter the address nginx sees; inspect the observed client before choosing your access CIDRs. `ALLOWED_NETWORKS=all` permits all clients that can reach nginx, so the default host loopback binding is the initial access boundary. For a new outer reverse proxy, determine the actual peer addresses and whether nginx sees the original client; forwarding an HTTP header alone does not change an IP allow list. Do not set `TRUST_PROXY=true` to work around a mismatch. See [security](security.md).

Changes to Compose environment values generally require service recreation with `docker compose up -d`; changing `.env` alone does not update running processes. Native template changes require rendering, reviewing and reinstalling the affected files, then reloading/restarting the affected services.
