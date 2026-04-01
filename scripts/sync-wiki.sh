#!/usr/bin/env bash
set -euo pipefail

# Sync local docs/wiki content to GitHub Wiki.
#
# Usage (local):
#   scripts/sync-wiki.sh
#
# Required env:
#   - GITHUB_REPOSITORY (e.g. owner/repo) OR REPO_SLUG
#   - WIKI_PUSH_TOKEN (recommended) OR GH_TOKEN OR GITHUB_TOKEN
#
# Optional env:
#   - WIKI_SOURCE_DIR (default: docs/wiki)
#   - WIKI_COMMITTER_NAME (default: github-actions[bot])
#   - WIKI_COMMITTER_EMAIL (default: github-actions[bot]@users.noreply.github.com)

SOURCE_DIR="${WIKI_SOURCE_DIR:-docs/wiki}"
REPO_SLUG="${REPO_SLUG:-${GITHUB_REPOSITORY:-}}"
TOKEN="${WIKI_PUSH_TOKEN:-${GH_TOKEN:-${GITHUB_TOKEN:-}}}"
COMMITTER_NAME="${WIKI_COMMITTER_NAME:-github-actions[bot]}"
COMMITTER_EMAIL="${WIKI_COMMITTER_EMAIL:-github-actions[bot]@users.noreply.github.com}"
ROOT_DIR="${GITHUB_WORKSPACE:-$(pwd -P)}"
SOURCE_ABS="${ROOT_DIR}/${SOURCE_DIR}"

if [[ -z "${REPO_SLUG}" ]]; then
  echo "ERROR: Missing repository slug. Set GITHUB_REPOSITORY or REPO_SLUG (owner/repo)." >&2
  exit 1
fi

if [[ -z "${TOKEN}" ]]; then
  echo "ERROR: Missing token. Set WIKI_PUSH_TOKEN (or GH_TOKEN/GITHUB_TOKEN)." >&2
  exit 1
fi

if [[ ! -d "${SOURCE_ABS}" ]]; then
  echo "ERROR: Source directory '${SOURCE_ABS}' not found." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

WIKI_REMOTE="https://x-access-token:${TOKEN}@github.com/${REPO_SLUG}.wiki.git"

echo "Cloning wiki: ${REPO_SLUG}.wiki.git"
git clone "${WIKI_REMOTE}" "${TMP_DIR}/wiki" >/dev/null 2>&1 || {
  echo "ERROR: Could not clone wiki repository. Ensure Wiki is enabled on GitHub." >&2
  exit 1
}

cd "${TMP_DIR}/wiki"

echo "Syncing files from ${SOURCE_DIR}"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete --exclude '.git/' "${SOURCE_ABS}/" ./
else
  # Fallback for environments without rsync
  find . -mindepth 1 -maxdepth 1 ! -name ".git" -exec rm -rf {} +
  cp -R "${SOURCE_ABS}/." ./
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo "No wiki changes detected."
  exit 0
fi

git config user.name "${COMMITTER_NAME}"
git config user.email "${COMMITTER_EMAIL}"

git add .
git commit -m "docs(wiki): sync from ${SOURCE_DIR}" >/dev/null
git push origin master >/dev/null

echo "Wiki sync completed successfully."
