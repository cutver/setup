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
  - Linux musl `x86_64` (`linux-musl-x86_64`) and `arm64` (`linux-musl-arm64`), for Alpine and other musl runners
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

### Alpine and musl runners

Cutver ships both a glibc and a musl build for Linux. On a musl runner the glibc binary cannot start, so the
action selects the `linux-musl-*` archive when the running process is itself linked against musl. The check
looks at the runner's own process, so a glibc host that merely has a musl toolchain installed for
cross-compilation is not mistaken for a musl runner. Detection is the default, so a musl job needs no edit:

```yaml
- name: Setup Cutver CLI on Alpine
  uses: cutver/setup@v1
```

Set `libc` to force the family when detection cannot help, for example a container that presents a different
loader than the one in use:

```yaml
- name: Setup Cutver CLI, forcing the musl build
  uses: cutver/setup@v1
  with:
    libc: "musl"
```

The input is ignored outside Linux runners, an unknown value fails the step, and the musl archives have no
legacy target name, so no fallback to a historical triple is attempted for them.

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
| `libc` | Linux libc family used to pick the archive: `"auto"` reads it from the running process, `"gnu"` or `"musl"` force it. Ignored outside Linux runners. | No | `"auto"` |
| `verify-checksum` | Verify the downloaded archive against the release `SHA256SUMS` before extracting it. The step fails if the digest does not match, or if the release publishes no `SHA256SUMS` or no entry for the downloaded asset. Set to `"false"` only for releases published before `SHA256SUMS` existed. | No | `"true"` |

### Outputs

| Output | Description | Example |
| :--- | :--- | :--- |
| `installed-version` | The exact SemVer version of Cutver installed on the runner. | `0.5.1` |

---

## Complete Release Workflow Example

Pair `cutver/setup` with [`cutver/release`](https://github.com/cutver/release) to automate versioning and release notes:

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - name: Setup Git credentials
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

      - name: Setup Cutver CLI
        id: setup-cutver
        uses: cutver/setup@v1

      - name: Run Cutver Release
        uses: cutver/release@v1
        with:
          command: release
          bump: auto

      - name: Log Installed Version
        run: echo "Installed Cutver v${{ steps.setup-cutver.outputs.installed-version }}"
```

---

## Documentation & Ecosystem

- **Core Engine**: [cutver/cutver](https://github.com/cutver/cutver) — Format-preserving release orchestration engine in Rust.
- **Release Action**: [cutver/release](https://github.com/cutver/release) — GitHub Action to run Cutver release pipelines.
- **Community & Profile**: [cutver/.github](https://github.com/cutver/.github) — Organization profile and architectural guarantees.

---

## License

MIT © [Cutver Authors](https://github.com/cutver/cutver) & [Row0902](https://github.com/Row0902)
