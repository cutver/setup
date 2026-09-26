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

- **Multi-Platform Support**: Automatically detects runner OS and architecture:
  - Linux `x86_64` (`x86_64-unknown-linux-gnu`)
  - macOS `x86_64` (`x86_64-apple-darwin` / Intel)
  - macOS `arm64` (`aarch64-apple-darwin` / Apple Silicon)
  - Windows `x86_64` (`x86_64-pc-windows-msvc`)
- **Fast & Cached**: Caches downloaded binaries in the runner's tool-cache directory to avoid redundant downloads across workflow steps.
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

---

## Action Specification

### Inputs

| Input | Description | Required | Default |
| :--- | :--- | :---: | :--- |
| `version` | Target SemVer version of Cutver to install (e.g. `"0.5.1"` or `"latest"`). Leading `'v'` is automatically stripped. | No | `"latest"` |
| `github-token` | GitHub token used to authenticate GitHub API requests when resolving the latest release. | No | `${{ github.token }}` |

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
