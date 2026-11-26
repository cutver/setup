# cutver-native release for cutver/setup

Replace this action's release pipeline, which still calls the deprecated `cutver/release@v1` and
publishes through `softprops/action-gh-release`, with a cutver-native two-phase release, and bring
the CI up to cutver's current diagnostic surface.

## Specs

S1. `cutver/release` is deprecated. Verbatim from the human: "Deprequé la cutver/release, que era la
action que completaba el trabajo faltante de cutver/setup, osea, esta, ahora el mismo cutver hace todo
lo que hacía esta y más." Consequence for this repository: `.github/workflows/release.yml` must stop
using `cutver/release@v1` and stop letting `softprops/action-gh-release` own the release record; the
cutver CLI creates and publishes it.

S2. Update the workflow with cutver's newer features and the CI. Verbatim from the human: "Sí, vamos
con el workflow y las nuevas features de cutver para este repo, investiga todo lo nuevo que vamos a
actualizar el ci". Consequence: adopt the two-phase `bump --defer-publish` / `publish` split, the
`github-publish` plugin's draft-then-promote flow, release notes streamed from a template and declared
artifacts; add the `doctor --check-changelog` gate to CI. The prerelease channel ladder is deferred on
purpose: it ships in cutver 0.22.0, the stable release this action installs is 0.21.0, and an input
offering `alpha`/`beta`/`rc` would fail on every use (native review finding R4-001).

## Tasks

- T1 — `cutver.toml`: declare `[plugins.github-publish]` (repository `cutver/setup`, `draft = true`,
  `title_template`), its permissions and config, and a `[[artifact]]` for the committed bundle. (S2)
- T2 — `.github/workflows/release.yml`: rewrite as the CLI-native flow — mandatory bot token,
  dogfood `uses: ./` with `plugins: "true"`, `plugin restore`, `doctor --check-changelog`,
  `bump --defer-publish`, render notes through the template, `publish --notes-file -`, promote the
  draft; delete the `softprops` step. (S1, S2)
- T3 — `.github/workflows/ci.yml`: add the `doctor --check-changelog` job on `pull_request`,
  pinned by commit SHA rather than the floating `v1`. (S2)
- T4 — `README.md`: replace the three remaining `cutver/release` references with the cutver-native
  flow. (S1)
- T5 — Verify: parse both workflows, validate `cutver.toml` with the cutver binary when available,
  and keep `pnpm run check` green. (S1, S2)

Out of scope, deliberately: `[gates]` attestations (needs a design for where an attestation for a
bot-created commit can honestly come from), and the duplicate `### 🛠️ Maintenance & Dependencies`
heading the release template renders for `chore`+`ci` in one release — separate slice.

## Log

L1. Human: "Deprequé la cutver/release, que era la action que completaba el trabajo faltante de
cutver/setup, osea, esta, ahora el mismo cutver hace todo lo que hacía esta y más. Primero commitea,
push y PR de esto" — the commit/push/PR part landed as PR #9 (musl builds), before this feature.

L2. Human: "Sí, vamos con el workflow y las nuevas features de cutver para este repo, investiga todo
lo nuevo que vamos a actualizar el ci" — authorizes this feature.

L3. Evidence gathered before design (explorer + cutver docs): `cutver/bump` → `--defer-publish` stops
after the branch push and writes `released/deferred/version/tag/commit/floating_tag` to
`$GITHUB_OUTPUT`; `cutver publish --tag X --commit Y --notes-file -` validates the tag against the
manifests at `HEAD`, refuses an empty notes stream before tagging, verifies `[[artifact]]` globs and
dispatches the `on_post_release` plugins; `github-publish` is `runtime = "wasm"` and a lean build
fails closed, so the dogfooding step must install `plugins: "true"`; the draft must be promoted
afterwards because `draft = true` is what stops an asset-less public release.

L4. Native review (lineage `review-8e8e7e3af9c95586`, tier high) raised R4-001: the `channel` input
offered `alpha`/`beta`/`rc` while the installed CLI is 0.21.0, which rejects `--channel`, so any
non-stable dispatch failed before the bump. Correction: the input and the two-state promotion are
gone; the workflow passes no channel at all and promotion is stable-only. The ladder returns with the
first cutver stable that carries it, and the contract test now fails if a `channel` input reappears
before then.

L5. Second native review (lineage `review-81e7577d0a40ce46`, tier high, base `f5750f1`,
candidate `775c07c`) raised two criticals, both introduced by this change and both fixed:

- **R1-001** (`risk`, `ci.yml:40-49`): the doctor gate ran on `pull_request` and handed the
  repository `GITHUB_TOKEN` to `cutver plugin restore` and `cutver doctor` over a PR-controlled
  checkout. `cutver.toml` travels in the PR and can declare a wasm plugin with an environment
  grant for `GITHUB_TOKEN` and arbitrary network grants, so a fork PR could have loaded a plugin
  that exfiltrates the token. The job is now push-only.
- **R4-001** (`resilience`, `release.yml:150`, deterministic): the deferred publish had no
  fix-forward route. `bump --defer-publish` pushes the release commit, so a later failure left it
  untagged, a re-run bumped again into a rejected push, and a fresh dispatch bumped past the
  pending version. The workflow now takes `resume-tag` and `resume-commit`, finishes that exact
  release without bumping, and relies on `cutver publish` refusing an existing tag for repeatability.

Both are pinned by the contract test (33 tests). The review itself could not be closed: the
provider's `correction_lines` slot rejected every submission with
`collectBinding is missing or stale for current STATUS` — five times across two lineages, in both
documented binding forms, once without the candidate having been edited at all, each time with
`mutation_performed: false`.
