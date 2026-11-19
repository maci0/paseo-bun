#!/usr/bin/env bash
set -euo pipefail

archive=$(realpath "${1:?Pass the Linux x64 desktop tarball}")
output=$(realpath -m "${2:?Pass the output AppImage path}")
tool=$(realpath "${APPIMAGETOOL:?Set APPIMAGETOOL to the appimagetool executable}")
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
appdir="$stage/AppDir"
mkdir -p "$appdir" "$(dirname "$output")"
tar -xzf "$archive" -C "$appdir"
bundle="$appdir/paseo-bun"
test -x "$bundle/paseo-bun"
test -x "$bundle/paseo-bun-desktop"
cp "$bundle/share/applications/sh.paseo.bun.desktop" "$appdir/"
cp "$bundle/share/icons/hicolor/256x256/apps/sh.paseo.bun.png" "$appdir/"
sha256sum "$archive" | cut -d ' ' -f 1 > "$appdir/bundle-id"
cat > "$appdir/AppRun" <<'LAUNCHER'
#!/bin/sh
set -eu
appdir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
id=$(cat "$appdir/bundle-id")
store=${XDG_DATA_HOME:-"$HOME/.local/share"}/paseo-bun/appimage
bundle="$store/$id"
# The daemon can outlive the window and needs its runtime after the mount disappears.
if [ ! -d "$bundle" ]; then
  mkdir -p "$store"
  stage=$(mktemp -d "$store/.extract.XXXXXX")
  trap 'rm -rf -- "$stage"' EXIT
  cp -a -- "$appdir/paseo-bun/." "$stage/"
  mv -T -- "$stage" "$bundle" || test -d "$bundle"
  rm -rf -- "$stage"
  trap - EXIT
fi
export PASEO_APPIMAGE_PATH="${APPIMAGE:-}"
exec "$bundle/paseo-bun-desktop" "$@"
LAUNCHER
chmod +x "$appdir/AppRun"
ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$tool" "$appdir" "$output"
(cd "$(dirname "$output")" && sha256sum "$(basename "$output")" > "$(basename "$output").sha256")
