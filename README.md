<div align="center">

# Setup Cutver CLI

**Official GitHub Action to download, cache, and add the Cutver CLI to `$PATH`.**

[![Release](https://img.shields.io/github/v/release/cutver/setup?logo=github&color=blue)](https://github.com/cutver/setup/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform Support](https://img.shields.io/badge/platforms-Linux%20%7C%20macOS%20%7C%20Windows-blue)](https://github.com/cutver/cutver)

---

</div>

`cutver/setup` installs the official standalone [Cutver](https://github.com/cutver/cutver) release engine binary on your GitHub Actions runners. It leverages `@actions/tool-cache` to ensure fast, deterministic setups with cross-job caching.

## Features

- **Multi-Platform Support**: Automatically detects runner OS and architecture across the full 64-bit platform matrix:
  - Linux `x86_64` (`linux-x86_64` / legacy `x86_64-unknown-linux-gnu`)
  - Linux `arm64` (`linux-arm64`)
  - macOS `x86_64` (`macos-x86_64` / legacy `x86_64-apple-darwin` / Intel)
  - macOS `arm64` (`macos-arm64` / legacy `aarch64-apple-darwin` / Apple Silicon)
  - Windows `x86_64` (`windows-x86_64` / legacy `x86_64-pc-windows-msvc`)
  - Windows `arm64` (`windows-arm64`)
- **Dual-Slug Resolution**: Seamlessly downloads modern standard slug assets (`cutver-{version}-{os}-{arch}.{ext}`) with automatic fallback to historical release target tuples.
- **Fast & Cached**: Caches downloaded binaries in the runner's tool-cache directory to avoid redundant downloads across workflow steps. Supports cache invalidation via `cache: false`.
- **Verified Downloads**: Checks each freshly downloaded archive against the release `SHA256SUMS` before extracting it and fails closed when the checksum is missing or does not match. Verification is on by default; a caller that sets `verify-checksum: "false"` gets the archive extracted unverified.
- **Floating Tag Support**: Use `cutver/setup@v1` to always run the latest non-breaking setup action.
- **Zero Heavy Runtime**: Bundled with `@vercel/ncc` into a standalone Node 24 action with zero runner package dependencies.

---

## Usage

### Basic Usage (Latest Release)

```yaml
steps:
  - uses: actions/checkout@v7
    with:
      fetch-depth: 0

  - name: Setup Cutver CLI
    uses: cutver/setup@v1

  - name: Verify Installation
    run: cutver --version
```

### Pinning a Specific Cutver Version

```yaml
- name: Setup Cutver CLI v0.5.1
  uses: cutver/setup@v1
  with:
    version: "0.5.1"
```

### Authenticating GitHub API Requests

When resolving `"latest"`, GitHub API rate limits apply to unauthenticated requests. Pass `github-token` to authenticate:

```yaml
- name: Setup Cutver CLI
  uses: cutver/setup@v1
  with:
    version: "latest"
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Enabling Plugin Support (`cutver-plugins-*`)

To install the WebAssembly and plugin-capable binary variant of Cutver:

```yaml
- name: Setup Cutver CLI with plugins
  uses: cutver/setup@v1
  with:
    plugins: "true"
```

### Integrity Verification

Every download is verified before it is extracted, unless the caller sets `verify-checksum: "false"`. After
fetching the archive, the action downloads the release's `SHA256SUMS` from the same `releases/download/v<version>/`
directory, computes the archive's SHA-256 and compares both digests. A mismatch fails the step with the
expected and the actual digest, and nothing is extracted. Verification is on by default, so existing
workflows gain it without any edit.

Because the step fails closed, a release published before `SHA256SUMS` existed — or one whose
`SHA256SUMS` has no entry for the downloaded asset — fails instead of silently installing an unverified
binary. Only that case needs the explicit opt-out:

```yaml
- name: Setup Cutver CLI from a release without SHA256SUMS
  uses: cutver/setup@v1
  with:
    version: "0.0.1"
    verify-checksum: "false"
```

Disabling verification means the archive is installed without any integrity check.

A tool-cache hit is trusted: when the runner already holds the requested version, nothing is downloaded and
nothing is verified. A tree cached by a run with `verify-checksum: "false"` is therefore reused by a later
run that has verification enabled. Use `cache: "false"` when you need a fresh, verified download.

---

## Action Specification

### Inputs

| Input | Description | Required | Default |
| :--- | :--- | :---: | :--- |
| `version` | Target SemVer version of Cutver to install (e.g. `"0.5.1"` or `"latest"`). Leading `'v'` is automatically stripped. | No | `"latest"` |
| `github-token` | GitHub token used to authenticate GitHub API requests when resolving the latest release. | No | `${{ github.token }}` |
| `cache` | Whether to use the runner tool-cache. Set to `false` to bypass local cache and force fresh download. | No | `"true"` |
| `plugins` | Whether to install the plugin-enabled Cutver binary variant (`cutver-plugins-*`). Set to `"true"` when using WebAssembly plugins. | No | `"false"` |
| `verify-checksum` | Verify the downloaded archive against the release `SHA256SUMS` before extracting it. The step fails if the digest does not match, or if the release publishes no `SHA256SUMS` or no entry for the downloaded asset. Set to `"false"` only for releases published before `SHA256SUMS` existed. | No | `"true"` |

### Outputs

| Output | Description | Example |
| :--- | :--- | :--- |
| `installed-version` | The exact SemVer version of Cutver installed on the runner. | `0.5.1` |

---

## Complete Release Workflow Example

The Cutver CLI owns the whole release: it bumps the manifests, renders the notes through your template, creates the release record and publishes it. Install the CLI with `cutver/setup` and call it directly:

```yaml
name: Release

on:
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Git credentials
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

      - name: Setup Cutver CLI
        id: setup-cutver
        uses: cutver/setup@v1
        with:
          # The release record is created by the `github-publish` plugin, which ships in
          # the plugin-enabled build only; a lean binary fails closed on it.
          plugins: "true"

      # The plugin driver reads its wasm artifact from the cache when it is constructed.
      - name: Restore declared plugins
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: cutver plugin restore

      - name: Validate configuration and changelog
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: cutver doctor --check-changelog

      # Stops after the release commit is pushed: the tag and the release wait for `publish`.
      # `GITHUB_TOKEN` is in scope because this config declares a plugin that reads it.
      - name: Bump and defer the publish
        id: cutver
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: cutver bump auto --defer-publish

      # Written outside the workspace because `[git] require_clean_tree` rejects a dirty tree.
      - name: Render release notes
        if: steps.cutver.outputs.released == 'true'
        run: |
          cutver changelog latest --template .github/templates/cutver/RELEASE.md > "$RUNNER_TEMP/RELEASE_NOTES.md"

      - name: Publish the release
        if: steps.cutver.outputs.released == 'true'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
        run: |
          cat "$RUNNER_TEMP/RELEASE_NOTES.md" | cutver publish --tag "${{ steps.cutver.outputs.tag }}" --commit "${{ steps.cutver.outputs.commit }}" --notes-file -

      # `[plugins.github-publish.config] draft = true` is what keeps an asset-less release
      # from going public, so promote only after `publish` succeeded. A config without that
      # plugin creates no release record and needs no promotion at all.
      - name: Promote the release
        if: steps.cutver.outputs.released == 'true'
        env:
          TAG: ${{ steps.cutver.outputs.tag }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: gh release edit "$TAG" --draft=false --prerelease=false --latest=true

      - name: Log Installed Version
        run: echo "Installed Cutver v${{ steps.setup-cutver.outputs.installed-version }}"
```

---

## Documentation & Ecosystem

- **Core Engine**: [cutver/cutver](https://github.com/cutver/cutver) — Format-preserving release orchestration engine in Rust.
- **Community & Profile**: [cutver/.github](https://github.com/cutver/.github) — Organization profile and architectural guarantees.

---

## License

MIT © [Cutver Authors](https://github.com/cutver/cutver) & [Row0902](https://github.com/Row0902)
