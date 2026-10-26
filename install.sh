#!/usr/bin/env bash
# ZCode RTL — one-click installer for Linux and macOS.
#   Install:   bash install.sh
#   Uninstall: bash install.sh --uninstall
set -euo pipefail

OS="$(uname -s)"
case "$OS" in
  Linux)  DEST="$HOME/.local/share/ZCodeRTL" ;;
  Darwin) DEST="$HOME/Library/Application Support/ZCodeRTL" ;;
  *) echo "Unsupported OS: $OS (Windows users: run install.ps1)"; exit 1 ;;
esac

# --- uninstall: remove launcher + installed copy ---
if [ "${1:-}" = "--uninstall" ]; then
  rm -rf "$DEST"
  rm -f "$HOME/.local/share/applications/zcode-rtl.desktop" "$HOME/Desktop/zcode-rtl.desktop" 2>/dev/null || true
  rm -rf "$HOME/Applications/ZCode RTL.app"
  echo "ZCode RTL removed."
  echo "If a background node injector is still running it stops at next logout (or: pkill -f injector.mjs)."
  exit 0
fi

# --- resolve source: this checkout, or a fresh download (curl | bash mode) ---
REPO="https://github.com/ahmadkhanloo/VibeHub"
SRC="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$SRC/apps/ZCode/injector.mjs" ]; then
  echo "Downloading VibeHub source for the legacy ZCode RTL adapter..."
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$REPO/archive/refs/heads/main.tar.gz" -o "$TMP/src.tar.gz"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TMP/src.tar.gz" "$REPO/archive/refs/heads/main.tar.gz"
  else
    echo "Neither curl nor wget found. Clone and run instead:" >&2
    echo "  git clone $REPO.git && cd VibeHub && bash install.sh" >&2
    exit 1
  fi
  tar -xzf "$TMP/src.tar.gz" -C "$TMP"
  SRC_GLOB=("$TMP"/VibeHub-*/)
  SRC="${SRC_GLOB[0]:%/}"
  if [ ! -d "$SRC" ]; then
    echo "Unexpected archive layout. Clone and run instead:" >&2
    echo "  git clone $REPO.git && cd VibeHub && bash install.sh" >&2
    exit 1
  fi
fi

# --- requirements: Node >= 21 (needs the built-in WebSocket) ---
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found on PATH. Install Node 21+ from https://nodejs.org" >&2
  exit 1
fi
NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 21 ]; then
  echo "Node >= 21 required (found $(node --version))." >&2
  exit 1
fi

# --- locate ZCode ---
find_zcode() {
  if [ "$OS" = "Darwin" ]; then
    for p in "/Applications/ZCode.app/Contents/MacOS/ZCode" "$HOME/Applications/ZCode.app/Contents/MacOS/ZCode"; do
      [ -x "$p" ] && { echo "$p"; return 0; }
    done
  else
    command -v zcode >/dev/null 2>&1 && { command -v zcode; return 0; }
    for p in /usr/bin/zcode /usr/local/bin/zcode /opt/ZCode/zcode /opt/zcode/zcode "$HOME/.local/bin/zcode"; do
      [ -x "$p" ] && { echo "$p"; return 0; }
    done
  fi
  return 1
}
if ! EXE="$(find_zcode)"; then
  echo "ZCode not found in standard locations. Install ZCode first." >&2
  exit 1
fi

# --- files ---
mkdir -p "$DEST"
cp "$SRC/apps/ZCode/launch.sh" "$SRC/apps/ZCode/injector.mjs" "$DEST/"
chmod +x "$DEST/launch.sh"

# --- launcher ---
if [ "$OS" = "Darwin" ]; then
  APP="$HOME/Applications/ZCode RTL.app"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>ZCode RTL</string>
  <key>CFBundleDisplayName</key><string>ZCode RTL</string>
  <key>CFBundleExecutable</key><string>ZCodeRTL</string>
  <key>CFBundleIdentifier</key><string>com.ahmadkhanloo.zcode-rtl</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.1.0</string>
  <key>CFBundleIconFile</key><string>app</string>
</dict>
</plist>
PLIST
  cat > "$APP/Contents/MacOS/ZCodeRTL" <<EOF
#!/bin/sh
exec "$DEST/launch.sh"
EOF
  chmod +x "$APP/Contents/MacOS/ZCodeRTL"
  ZICONS="/Applications/ZCode.app/Contents/Resources/electron.icns"
  if [ -f "$ZICONS" ]; then cp "$ZICONS" "$APP/Contents/Resources/app.icns"; fi
  LAUNCHER="$APP"
else
  DESKTOP_DIR="$HOME/.local/share/applications"
  mkdir -p "$DESKTOP_DIR"
  ICON=""
  for c in /usr/share/pixmaps/zcode.png /opt/ZCode/zcode.png /opt/zcode/zcode.png; do
    [ -f "$c" ] && { ICON="$c"; break; }
  done
  {
    echo "[Desktop Entry]"
    echo "Type=Application"
    echo "Name=ZCode RTL"
    echo "Comment=Run ZCode with right-to-left support"
    echo "Exec=$DEST/launch.sh"
    [ -n "$ICON" ] && echo "Icon=$ICON"
    echo "Terminal=false"
    echo "Categories=Development;"
  } > "$DESKTOP_DIR/zcode-rtl.desktop"
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DESKTOP_DIR" || true
  DESKTOP="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
  mkdir -p "$DESKTOP"
  cp "$DESKTOP_DIR/zcode-rtl.desktop" "$DESKTOP/zcode-rtl.desktop" 2>/dev/null || true
  LAUNCHER="$DESKTOP_DIR/zcode-rtl.desktop"
fi

echo ""
echo "ZCode RTL installed."
echo "  App:      $EXE"
echo "  Files:    $DEST"
echo "  Launcher: $LAUNCHER"
echo ""
echo "Next: fully close ZCode, then start it via the 'ZCode RTL' launcher."
