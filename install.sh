#!/bin/sh
# Installs the Sizzle skill for Claude Code (~/.claude/skills/sizzle) or Cursor (~/.cursor/skills/sizzle)
#   curl -fsSL https://mhfrough.github.io/sizzle/install.sh | sh               # Claude Code
#   curl -fsSL https://mhfrough.github.io/sizzle/install.sh | sh -s -- cursor  # Cursor
# Running it again updates the skill. For other agents: npx skills add mhfrough/sizzle
set -e

AGENT="${1:-${SIZZLE_AGENT:-claude}}"
case "$AGENT" in
  claude) DIR="$HOME/.claude/skills/sizzle"; APP="Claude Code" ;;
  cursor) DIR="$HOME/.cursor/skills/sizzle"; APP="Cursor" ;;
  *) echo "Unknown agent '$AGENT'. Use claude or cursor." >&2; exit 1 ;;
esac
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
# Cursor also loads skills from ~/.claude/skills, so a Claude Code copy would show up twice
if [ "$AGENT" = cursor ] && [ -f "$HOME/.claude/skills/sizzle/SKILL.md" ]; then
  echo "Note: Cursor also reads ~/.claude/skills/sizzle, so you may see Sizzle twice. Keep one of them."
fi
echo "Restart $APP, then ask: make a promo reel for this app."
