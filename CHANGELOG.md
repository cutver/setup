# Changelog

All notable changes to this project will be documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com).

## [v1.3.0] - 2026-11-26
### 🚀 Features & Enhancements
- install musl builds when the runner is musl-linked in [#9](https://github.com/cutver/setup/pull/9) ([66ba3e0](https://github.com/cutver/setup/commit/66ba3e0ef5b1ea5476e7ba0255f1fee93000ccfd)) by @Row0902
- verify the downloaded archive against SHA256SUMS ([f5750f1](https://github.com/cutver/setup/commit/f5750f14d73e8b98fd94227ea1ef631493504616)) by @Row0902

### 📚 Documentation
- declare 1.3.0 compatible with 1.x consumers in [#12](https://github.com/cutver/setup/pull/12) ([82b803b](https://github.com/cutver/setup/commit/82b803b069064d3c4de33ea40e880e5d69c658ab)) by @Row0902

### 🛠️ Maintenance & Dependencies
- let the doctor gate be dispatched by hand in [#11](https://github.com/cutver/setup/pull/11) ([be8d422](https://github.com/cutver/setup/commit/be8d422dd2a6f8eab06672ca295c249317336c5a)) by @Row0902
- cut a release with cutver itself, not with cutver/release in [#10](https://github.com/cutver/setup/pull/10) ([0f2473b](https://github.com/cutver/setup/commit/0f2473b6fbe53c6c08df1dbeda3066898e1c2916)) by @Row0902

### 👥 Contributors
- @Row0902


---
**Full Changelog**: https://github.com/cutver/setup/compare/v1.2.0...v1.3.0 • *CI Build #12*
## [v1.2.0] - 2026-11-11
### 🚀 Features & Enhancements
- add plugins input to install plugin-enabled cutver variant in [#8](https://github.com/cutver/setup/pull/8) ([5b78050](https://github.com/cutver/setup/commit/5b78050910b72cd1b15241783c6398c5864ac964)) by @Row0902

### 🛠️ Maintenance & Dependencies
- authenticate release workflow using cutver-release[bot] in [#7](https://github.com/cutver/setup/pull/7) ([a963825](https://github.com/cutver/setup/commit/a9638254bfaf80d868ad2df7e298563f071c3931)) by @Row0902
- convert release workflow to on-demand workflow_dispatch and add CI check in [#5](https://github.com/cutver/setup/pull/5) ([ce2167e](https://github.com/cutver/setup/commit/ce2167eb2ad242f586b6d841e9915d8845b09319)) by @Row0902

### 🛠️ Maintenance & Dependencies
- adopt modern release template, native floating major tags, and action outputs in [#6](https://github.com/cutver/setup/pull/6) ([3f67a22](https://github.com/cutver/setup/commit/3f67a22a7dfac093914bb98d4be678a2a69032cd)) by @Row0902

### 👥 Contributors
- @Row0902


---
**Full Changelog**: https://github.com/cutver/setup/compare/v1.1.0...v1.2.0 • *CI Build #10*
## [v1.1.0] - 2026-10-05

**✨ What's Changed in v1.1.0**

### 🚀 Features & Enhancements
- expand 64-bit matrix, dual-slug resolver with legacy fallback, and cache invalidation in [#4](https://github.com/cutver/setup/pull/4) ([39fd6f1](https://github.com/cutver/setup/commit/39fd6f1d70c3b6cc8a8256d61bced59cfcfc8647)) by @Row0902

### 👥 Contributors
- @Row0902

---
**Full Diff**: https://github.com/cutver/setup/compare/v1.0.4...v1.1.0
## [v1.0.4] - 2026-09-26

**✨ What's Changed in v1.0.4**

### 📚 Documentation
- **readme**: add comprehensive documentation, inputs, outputs, and examples (#2)

### 👥 Contributors
- @Row0902

---
**Full Diff**: https://github.com/cutver/setup/compare/v1.0.3...v1.0.4
## [v1.0.3] - 2026-09-26

**✨ What's Changed in v1.0.3**

### 🐛 Bug Fixes
- **installer**: use cutver organization as upstream and return resolved version (#1)

### 👥 Contributors
- @Row0902

---
**Full Diff**: https://github.com/cutver/setup/compare/v1.0.2...v1.0.3
## [v1.0.2] - 2026-09-25

**✨ What's Changed in v1.0.2**

### 🧰 Maintenance & Dependencies
- automate floating major tags and prune local tags before release

### 👥 Contributors
- @Row0902

---
**Full Diff**: https://github.com/cutver/setup/compare/v1.0.1...v1.0.2
## [v1.0.1] - 2026-09-25

**✨ What's Changed in v1.0.1**

### 🧰 Maintenance & Dependencies
- use cutver/release@v1 and disable check-changelog for floating tags
- use official cutver/release@v1 action
- use official cutver/release@v1 action

### 👥 Contributors
- @Row0902

---
**Full Diff**: https://github.com/cutver/setup/compare/v1.0.0...v1.0.1
## [v1.0.0] - 2026-09-25

**✨ What's Changed in v1.0.0**

### ⚠️ Breaking Changes
- initial implementation of setup action

### 👥 Contributors
- @Row0902
## [Unreleased]
