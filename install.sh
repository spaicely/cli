#!/bin/sh
# Installs the Spaicely CLI from the latest GitHub Release:
#   curl -fsSL https://spaicely.com/install.sh | sh
# Picks the binary for this machine, checks its SHA-256 and puts it in
# ~/.local/bin (or SPAICELY_INSTALL_DIR). No sudo.
set -eu

repo="https://github.com/spaicely/cli/releases"
version="${SPAICELY_VERSION:-latest}"
dir="${SPAICELY_INSTALL_DIR:-$HOME/.local/bin}"

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *) echo "Unsupported system $(uname -s); on Windows use: winget install Spaicely.CLI" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64 | aarch64) arch=arm64 ;;
  x86_64 | amd64) arch=x64 ;;
  *) echo "Unsupported processor $(uname -m)" >&2; exit 1 ;;
esac

if [ "$version" = latest ]; then base="$repo/latest/download"; else base="$repo/download/v${version#v}"; fi
base="${SPAICELY_DOWNLOAD_BASE:-$base}"
file="spaicely-$os-$arch.tar.gz"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $file..."
curl -fsSL "$base/$file" -o "$tmp/$file"
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS"

expected="$(awk -v f="$file" '$2 == f { print $1 }' "$tmp/SHA256SUMS")"
if command -v sha256sum >/dev/null 2>&1; then actual="$(sha256sum "$tmp/$file" | awk '{ print $1 }')"
else actual="$(shasum -a 256 "$tmp/$file" | awk '{ print $1 }')"; fi
if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
  echo "Checksum mismatch for $file; nothing installed." >&2
  exit 1
fi

tar -xzf "$tmp/$file" -C "$tmp"
mkdir -p "$dir"
mv "$tmp/spaicely" "$dir/spaicely"
chmod 755 "$dir/spaicely"
echo "Installed $("$dir/spaicely" --version) in $dir/spaicely"

case ":$PATH:" in
  *":$dir:"*) ;;
  *) echo "Add $dir to your PATH, for example: echo 'export PATH=\"$dir:\$PATH\"' >> ~/.zshrc" ;;
esac
echo "Next: spaicely login"
