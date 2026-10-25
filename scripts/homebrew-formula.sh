#!/bin/sh
# Prints the Homebrew formula for a released version: scripts/homebrew-formula.sh 1.2.3 SHA256SUMS
set -eu
version="$1"
sums="$2"
base="https://github.com/spaicely/cli/releases/download/v$version"
sha() { awk -v file="spaicely-$1.tar.gz" '$2 == file { print $1 }' "$sums"; }

cat <<RUBY
class Spaicely < Formula
  desc "Preview, deploy and manage sites hosted on Spaicely"
  homepage "https://spaicely.com/developers/"
  version "$version"
  license "MIT"

  on_macos do
    on_arm do
      url "$base/spaicely-darwin-arm64.tar.gz"
      sha256 "$(sha darwin-arm64)"
    end
    on_intel do
      url "$base/spaicely-darwin-x64.tar.gz"
      sha256 "$(sha darwin-x64)"
    end
  end

  on_linux do
    on_arm do
      url "$base/spaicely-linux-arm64.tar.gz"
      sha256 "$(sha linux-arm64)"
    end
    on_intel do
      url "$base/spaicely-linux-x64.tar.gz"
      sha256 "$(sha linux-x64)"
    end
  end

  def install
    bin.install "spaicely"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/spaicely --version")
  end
end
RUBY
