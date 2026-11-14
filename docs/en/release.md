# Template and publication review

[Português](../pt/release.md) · [Documentation](README.md)

This public export is prepared for owner review. Publication, pushing to GitHub, enabling the GitHub template flag and publishing images/packages are separate actions. No GitHub repository or template setting is created or enabled by preparing these files.

## Before any public push

- Review the exported source, both documentation languages, configuration defaults, licences, third-party notices and illustrative screenshots. Confirm there is no operational database, collected publisher archive, model weight, `.env`, log, backup, private address or administrator setup URL.
- Scan the intended files and newly created Git objects for secrets and private material. A clean working tree alone does not prove clean history. If a secret was disclosed, rotate it; excluding a file does not revoke it.
- Start from the reviewed clean export in a **new repository with fresh history**. Never push a private deployment's existing `.git` directory, branches, tags, remotes or historical objects. Inspect the staged contents and first commit before adding a public remote.
- Verify the source/provider policy and model attribution. A successful source probe is not a content redistribution licence. Keep model weights separate and review their licences before downloading or distributing them.
- Run the release's required checks against isolated test resources and record the exact revision, commands, outcomes and limitations. Review any changed configuration or migration before deployment.
- Obtain the owner's explicit review approval **before the first public push**. The owner chooses the account, repository name, visibility and publication timing. This template supplies no assumed repository owner or remote URL.

## Validation scope of this export

Local preparation exercised the unit/build checks, PostgreSQL integration checks and fresh compiled initialization/migrations using a non-superuser application role. The dependency audit reported no known advisories at the time checked. These are observations for the reviewed revision and environment; record fresh results when preparing a later release.

Docker Compose configuration was validated. **Container image builds and stack startup were not exercised in this preparation environment**, because no Docker engine was available and none was installed on the existing host. The included CI workflow is prepared to build/start the stack and check HTTP responses on an isolated GitHub runner after approved publication. A workflow file is not evidence that a GitHub run has passed. Review its actual results before describing that path as verified.

## After approved publication

Create or choose a new empty repository under the owner's account, verify its remote URL and push only the reviewed fresh history. Review the public files and commit history again after the push. Do not upload private audit evidence or operational data as release assets.

The GitHub **Template repository** flag must be enabled by the owner in repository settings after approval/publication. It has not been enabled by this local preparation. Once enabled, visitors can use **Use this template** to create their own repository. They should clone their own repository URL, generate their own `.env` and review deployment/source settings.

Enable GitHub private vulnerability reporting where available, verify the private reporting route, and keep `SECURITY.md` accurate. Configure branch protection and required checks as appropriate for the repository. Run the prepared CI, inspect the results and resolve failures before tagging a release or publishing container images/packages.

Update `CHANGELOG.md` with the release version/date and relevant verified behaviour. Attach only reviewed source archives or intended public artifacts. Installation addresses, certificates, secrets, publisher content and backup storage remain the deploying operator's responsibility.
