# Docker installation validation

[Português](../pt/validation.md) · [Documentation](README.md)

The default Docker installation was exercised on 14 November 2026 in a disposable Linux environment, using a separate Docker daemon, network and data volume. Existing production deployments were not used. This records a tested configuration, not a guarantee for every host or future upstream image.

## Starting point

The test used a clean source archive of the intended public repository. No operational `.env`, database, certificate, log or private Git history was copied. GitHub cloning was not exercised because publication had not been authorized. The runtime source matched the prepared initial public commit; subsequent validation edits changed documentation only.

With the README prerequisites installed, the following commands were executed without changing the generated `.env` defaults:

```sh
node scripts/init-env.mjs
docker compose up -d --build --wait --wait-timeout 180
```

The helper generated independent private database-role passwords. Images built successfully; migrations and seed completed; the one-shot `init` exited with status 0. No external API key, personal network address or translation model was required.

Tested environment: Linux amd64, Node.js 24.22.3, Docker Engine 29.1.3, Compose 5.0.0, PostgreSQL 17.12 and nginx 1.30.6. Image tags can move; these are the versions observed during this run. The disposable environment was limited to two CPUs and 3 GiB memory; those limits are not a benchmark or a supported minimum.

## Results

| Check | Result |
| --- | --- |
| Frontend through nginx and backend `/api/health` | Passed |
| Three PostgreSQL migrations and non-superuser application role | Passed |
| Default live collection | BBC: 27 stories; Hacker News: 80 stories; both operational during the run |
| Dashboard in a real browser | Feed visible, desktop/mobile layout, no horizontal overflow, light/dark theme |
| Favourites | Saved through the UI and retained after reload |
| SSE transport | PostgreSQL notification → API → nginx → browser received; controlled notification referenced an existing story |
| Administration | Protected endpoint, one-time bootstrap, login, categories and cross-origin rejection |
| Container restart | Database/API/collector/web restarted; news, favourites, administrator and session retained |
| Container recreation | `docker compose down` followed by `up` retained the named volume and application data |
| Licences and image boundary | Legal notices present; application image contains no `.env`; API/web run as non-root with read-only filesystems |

The final persisted count was 107 stories. Provider results are a point-in-time observation; successful retrieval grants no additional rights in publisher content.

## Limits

- Only the default profile was exercised. This run did not build/start the optional translation image or download its models, enable Bluesky monitoring, or validate every optional publisher/platform.
- The browser checks demonstrate the interactions listed above. The illustrative README screenshots use separate synthetic demo data and source counts; they are not screenshots of this run or proof of provider uptime.
- The container test used Docker inside a dedicated disposable container. It does not certify every host OS, architecture, storage driver, external TLS proxy or power-loss scenario.
- GitHub cloning, Actions, publication, visibility and the Template setting remain separate owner-controlled actions. A local pass is not a GitHub Actions result.
- Native Debian/LXC instructions have their own earlier checks; this Docker run did not reinstall or restart a production native deployment.

Keep generated credentials, database volumes, logs, browser state and private validation reports out of commits and release archives. Before publishing a changed revision, repeat the checks and history-aware secret audit described in the [publication guide](release.md).
