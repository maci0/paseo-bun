#!/bin/sh
set -eu
install_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
data_dir=${XDG_DATA_HOME:-$HOME/.local/share}
case "$install_dir" in *'
'*) echo 'Installation path must not contain a newline' >&2; exit 1;; esac
mkdir -p "$data_dir/applications" "$data_dir/icons/hicolor/256x256/apps"
cp "$install_dir/share/icons/hicolor/256x256/apps/sh.paseo.bun.png" "$data_dir/icons/hicolor/256x256/apps/sh.paseo.bun.png"
entry="$data_dir/applications/sh.paseo.bun.desktop"
sed '/^Exec=/d' "$install_dir/share/applications/sh.paseo.bun.desktop" > "$entry"
# Escape both the desktop-entry value and its quoted Exec argument.
launch=$(printf '%s' "$install_dir/paseo-bun-desktop" | sed 's/\\/\\\\/g; s/"/\\"/g; s/`/\\`/g; s/\$/\\$/g; s/%/%%/g' | sed 's/\\/\\\\/g')
printf 'Exec="%s"\n' "$launch" >> "$entry"
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$data_dir/applications"; fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then gtk-update-icon-cache -f -t "$data_dir/icons/hicolor" >/dev/null 2>&1 || :; fi
if command -v kbuildsycoca6 >/dev/null 2>&1; then kbuildsycoca6 >/dev/null 2>&1; fi
printf 'Registered Paseo Bun desktop launcher and icon in %s\n' "$data_dir"
