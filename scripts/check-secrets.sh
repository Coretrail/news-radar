#!/bin/sh
# Downloads a version-pinned scanner locally; repository contents are never uploaded.
set -eu
version=8.24.3
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) platform=linux_x64 ;;
  Linux-aarch64|Linux-arm64) platform=linux_arm64 ;;
  *) echo 'Install Gitleaks on this platform and run: gitleaks git --redact --log-opts=--all .' >&2; exit 1 ;;
esac
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"' EXIT HUP INT TERM
archive="gitleaks_${version}_${platform}.tar.gz"
base="https://github.com/gitleaks/gitleaks/releases/download/v${version}"
curl -fsSL --retry 2 "$base/$archive" -o "$temporary/$archive"
curl -fsSL --retry 2 "$base/gitleaks_${version}_checksums.txt" -o "$temporary/checksums.txt"
(cd "$temporary" && sha256sum --check --ignore-missing checksums.txt)
tar -xzf "$temporary/$archive" -C "$temporary" gitleaks
"$temporary/gitleaks" git --redact --no-banner --log-opts=--all .
