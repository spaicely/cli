#!/bin/sh
# One standalone binary per platform, packed for download, plus SHA256SUMS.
set -eu
rm -rf release bin && mkdir -p release bin

for target in darwin-arm64 darwin-x64 linux-x64 linux-arm64 windows-x64; do
  case "$target" in
    windows-*) name=spaicely.exe ;;
    *) name=spaicely ;;
  esac
  mkdir -p "bin/$target"
  bun build --compile --minify --target="bun-$target" src/index.ts --outfile "bin/$target/$name"
  case "$target" in
    windows-*) (cd "bin/$target" && zip -q "../../release/spaicely-$target.zip" "$name") ;;
    *) tar -czf "release/spaicely-$target.tar.gz" -C "bin/$target" "$name" ;;
  esac
done

(cd release && sha256sum spaicely-* > SHA256SUMS)
cat release/SHA256SUMS
