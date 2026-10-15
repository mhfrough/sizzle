#!/bin/sh
# Installs the Sizzle skill for Claude Code into ~/.claude/skills/sizzle
#   curl -fsSL https://mhfrough.github.io/sizzle/install.sh | sh
# Running it again updates the skill. For other agents: npx skills add mhfrough/sizzle
set -e

DIR="$HOME/.claude/skills/sizzle"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL https://github.com/mhfrough/sizzle/archive/refs/heads/main.tar.gz | tar -xz -C "$TMP"
SRC="$TMP/sizzle-main/skills/sizzle"
if [ ! -f "$SRC/SKILL.md" ]; then
  echo "Download failed: skills/sizzle not found in the archive. Nothing was changed." >&2
  exit 1
fi
rm -rf "$DIR"
mkdir -p "$(dirname "$DIR")"
cp -R "$SRC" "$DIR"

echo "Sizzle installed to $DIR"
echo "Restart Claude Code, then ask: make a promo reel for this app."
