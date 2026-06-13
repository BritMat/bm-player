#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  BM Player — GitHub Deploy Script
#  Usage: ./deploy.sh <github_username> <personal_access_token>
#
#  Creates a GitHub repo, pushes the source, and the GitHub
#  Actions workflow automatically builds x64 + x86 .exe files.
#  Your installers will be in the Releases tab within ~15 min.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

USERNAME="${1:-}"
TOKEN="${2:-}"
REPO="bm-player"
VERSION="v1.0.0"

if [[ -z "$USERNAME" || -z "$TOKEN" ]]; then
  echo "Usage: $0 <github_username> <personal_access_token>"
  echo ""
  echo "Get a token at: https://github.com/settings/tokens/new"
  echo "Required scopes: repo, workflow"
  exit 1
fi

echo "▶ Creating GitHub repository: $USERNAME/$REPO"
REPO_RESP=$(curl -s -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/user/repos \
  -d "{\"name\":\"$REPO\",\"description\":\"BM Player — Modern mpv-powered media player\",\"private\":false,\"auto_init\":false}")

REPO_URL=$(echo "$REPO_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ssh_url', d.get('clone_url','')))" 2>/dev/null || echo "")
HTTP_URL=$(echo "$REPO_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('clone_url',''))" 2>/dev/null || echo "")

if [[ -z "$HTTP_URL" ]]; then
  echo "! Repo may already exist — trying to continue..."
  HTTP_URL="https://github.com/$USERNAME/$REPO.git"
fi

echo "▶ Updating electron-builder publish config..."
sed -i "s|owner: bm-player|owner: $USERNAME|g" electron-builder.yml
sed -i "s|url: \"https://github.com/bm-player/bm-player.git\"|url: \"https://github.com/$USERNAME/$REPO.git\"|g" package.json

echo "▶ Updating GitHub Actions workflow..."
sed -i "s|owner: bm-player|owner: $USERNAME|g" .github/workflows/release.yml

echo "▶ Initialising git..."
git init
git config user.name "BM Player Build"
git config user.email "$USERNAME@users.noreply.github.com"
git add -A
git commit -m "feat: initial BM Player v1.0.0

- Three.js fox mascot with media-reactive states
- mpv backend (all formats)
- Dark / Light / Liquid Glass themes
- VLC-style keybindings
- 4-mode audio visualizer (bars, radial, wave, particles)
- Auto-updater from GitHub Releases
- NSIS installer (x64 + x86)"

echo "▶ Pushing to GitHub..."
PUSH_URL="https://$TOKEN@github.com/$USERNAME/$REPO.git"
git remote add origin "$PUSH_URL" 2>/dev/null || git remote set-url origin "$PUSH_URL"
git branch -M main
git push -u origin main

echo "▶ Creating release tag $VERSION..."
git tag "$VERSION"
git push origin "$VERSION"

echo ""
echo "════════════════════════════════════════════════"
echo "✓ Done!  BM Player is building now."
echo ""
echo "  GitHub Actions:  https://github.com/$USERNAME/$REPO/actions"
echo "  Releases:        https://github.com/$USERNAME/$REPO/releases"
echo ""
echo "  The x64 and x86 .exe installers will appear in"
echo "  Releases within ~10 minutes."
echo "════════════════════════════════════════════════"
