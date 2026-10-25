# Spaicely CLI

Preview, deploy and manage sites hosted on [Spaicely](https://spaicely.com) from your terminal or CI.
Built for people who make their site themselves (Jekyll, Hugo, Eleventy, Astro, plain HTML) and for
AI coding tools such as Claude Code and Cursor.

The CLI talks to the same MCP server as the AI assistants that work on Spaicely sites, so it can do what
they can do, with the same rights. Every tool on the server is available through `spaicely call`, also
the ones without a command of their own yet.

## Install

| Where | Command |
| --- | --- |
| macOS, Linux with Homebrew | `brew install spaicely/tap/spaicely` |
| With Node.js 20+ | `npm i -g spaicely` (or `npx spaicely ...`) |
| macOS, Linux | `curl -fsSL https://spaicely.com/install.sh \| sh` |
| Windows | download `spaicely-windows-x64.zip` from the [latest release](https://github.com/spaicely/cli/releases/latest) |

Every release has a `SHA256SUMS` file and a build attestation:
`gh attestation verify spaicely-darwin-arm64.tar.gz --repo spaicely/cli`.

## Use

```sh
spaicely login                 # in the browser, like connecting an AI
spaicely sites                 # the sites you can work on
spaicely init --site 12        # spaicely.toml for this folder; recognises Jekyll, Hugo, Eleventy, Astro, Vite
spaicely serve --build         # look at it on http://localhost:4000
spaicely deploy --dry-run      # what would change compared to the live site
spaicely deploy                # build and upload a new version
spaicely publish               # put the newest version live (asks first)
spaicely rollback              # bring back the version that was live before
spaicely versions
spaicely tools                 # every tool on the server
spaicely call sites.files.list '{"site_id": 12}'
```

`spaicely.toml`:

```toml
site = 12                      # or "bakkerijjansen.nl"
dir = "_site"                  # the folder that goes up
build = "bundle exec jekyll build"
ignore = ["*.map", "drafts/**"]
```

Add `--json` before any command for machine-readable output. Exit codes: 0 done, 1 failed, 2 wrong use,
3 not signed in, 5 conflict while publishing.

## CI

Site keys for CI (one site, only the rights you pick) are on the way. With one stored as `SPAICELY_TOKEN`:

```yaml
- run: npx spaicely deploy --publish --yes
  env:
    SPAICELY_TOKEN: ${{ secrets.SPAICELY_TOKEN }}
```

## Where things are kept

The sign-in lives in `~/.config/spaicely/credentials.json` (mode 600). `spaicely logout` revokes it on
the server and removes the file. Messages follow the language of your Spaicely account (Dutch, English,
German or French).

## Development

```sh
npm ci && npm test
SPAICELY_MCP_URL=http://localhost:3000/mcp node dist/index.js whoami
```

Releases: bump `version` in `package.json` and `src/version.ts`, then push a tag `v<version>`.

MIT licence.
