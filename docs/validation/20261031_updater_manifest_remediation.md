# Updater manifest remediation — v0.2.0 and v0.2.1 (2026-10-31)

## Summary

Both published stable releases shipped a `latest.json` whose platform URLs pointed at a
draft upload path:

```text
https://github.com/ahmadkhanloo/VibeHub/releases/download/untagged-<hash>/VibeHub_<version>_x64-setup.nsis.zip
```

GitHub deletes the `untagged-*` path when a draft becomes a published release, so those
URLs returned **HTTP 404**. The installed app could discover an update from the tagged
manifest, but the archive download failed. The updater signature and archive bytes were
valid; only the published URLs were wrong.

The defect was repaired in place for `v0.2.0` and `v0.2.1` without rebuilding,
re-signing or re-uploading any archive. The release workflow was hardened so this class
of defect cannot be published again.

## Root cause

`release.yml` normalized `latest.json` while the GitHub Release was still a draft.
At that point `gh release view --json assets` reports temporary `untagged-*` download
URLs. The normalizer accepted any syntactically valid URL recorded in the manifest, and
the verification step only checked that an asset with the same name and a matching
`.sig` existed. No step requested the URL over HTTP after publication. Publishing then
discarded the draft path, leaving a dead URL in the manifest and in
`checksums-sha256.txt`.

## Live repair

### Releases

| Tag | Release ID | Published (UTC) | CI run |
| --- | --- | --- | --- |
| `v0.2.0` | 429531360 | 2026-10-30 22:04:14 | [41134688305](https://github.com/ahmadkhanloo/VibeHub/actions/runs/41134688305) |
| `v0.2.1` | 429813511 | 2026-10-31 08:33:41 | [41184427713](https://github.com/ahmadkhanloo/VibeHub/actions/runs/41184427713) |

### Manifest changes

Only `platforms.*.url` changed. `version`, `pub_date`, `notes` and both signature
values are byte-for-byte unchanged (confirmed by parsing before/after payloads).

| Tag | Before | After |
| --- | --- | --- |
| `v0.2.0` | `.../download/untagged-94f76cd591efe0bf89cd/VibeHub_0.2.0_x64-setup.nsis.zip` | `.../download/v0.2.0/VibeHub_0.2.0_x64-setup.nsis.zip` |
| `v0.2.1` | `.../download/untagged-c3955d37404fc93758f2/VibeHub_0.2.1_x64-setup.nsis.zip` | `.../download/v0.2.1/VibeHub_0.2.1_x64-setup.nsis.zip` |

Both `windows-x86_64` and `windows-x86_64-nsis` entries were rewritten.

### Asset replacement

The published assets were replaced through the GitHub REST API. The old asset was
deleted only after the repaired bytes were generated and validated locally; the upload
was verified by downloading the public URL again. Archives and signatures were not
touched.

| Tag | Asset | Old asset ID | New asset ID | Old size | New size |
| --- | --- | --- | --- | --- | --- |
| `v0.2.0` | `latest.json` | 693552331 | 694929887 | 4085 | 4039 |
| `v0.2.0` | `checksums-sha256.txt` | 693553958 | 694930168 | 805 | 796 |
| `v0.2.1` | `latest.json` | 694836198 | 694930472 | 4945 | 4899 |
| `v0.2.1` | `checksums-sha256.txt` | 694837295 | 694930535 | 805 | 796 |

`checksums-sha256.txt` was regenerated only for the `latest.json` line; every other
line, including the archive and `.sig` hashes, is unchanged.

| Tag | `latest.json` checksum before | `latest.json` checksum after |
| --- | --- | --- |
| `v0.2.0` | `83a6dff2cfb25f5a7adf5d7f86487480422228adb03f7d8c1987cf9dd3b8a7da` | `0ce338ddfb44d4fc5c420e0fb36c30b9246c604921c82874cbb93013017074bd` |
| `v0.2.1` | `6e6cc56e4cd87aa18c41649356078e1c8cf591a12797e7ef5f0f643e485230b1` | `7b07d700329e8505bc4f1897133a8715b46e53f55132727ae22c2356cc7891cb` |

### Public reachability (rechecked 2026-10-31 13:44 +03:30)

| URL | HTTP |
| --- | --- |
| `/releases/download/v0.2.0/latest.json` | 200 |
| `/releases/download/v0.2.0/VibeHub_0.2.0_x64-setup.nsis.zip` | 200 |
| `/releases/download/v0.2.0/VibeHub_0.2.0_x64-setup.nsis.zip.sig` | 200 |
| `/releases/download/untagged-94f76cd591efe0bf89cd/VibeHub_0.2.0_x64-setup.nsis.zip` | 404 |
| `/releases/download/v0.2.1/latest.json` | 200 |
| `/releases/download/v0.2.1/VibeHub_0.2.1_x64-setup.nsis.zip` | 200 |
| `/releases/download/v0.2.1/VibeHub_0.2.1_x64-setup.nsis.zip.sig` | 200 |
| `/releases/download/untagged-c3955d37404fc93758f2/VibeHub_0.2.1_x64-setup.nsis.zip` | 404 |
| `/releases/latest/download/latest.json` | 200 |

`releases/latest/download/latest.json` serves `version: 0.2.1`, both platform URLs are
the canonical tagged URL, and its SHA-256 is
`7b07d700329e8505bc4f1897133a8715b46e53f55132727ae22c2356cc7891cb`, matching the
`latest.json` line in the v0.2.1 checksum file.

Each manifest signature still equals the published `.sig` asset:
`/download/v0.2.1/VibeHub_0.2.1_x64-setup.nsis.zip.sig`.

## Code and workflow changes

- `scripts/normalize-updater-release.mjs` now requires `repository` and `tag` and
  builds URLs with `canonicalAssetUrl()`:
  `https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>`.
  It rejects `untagged-` URLs, non-semver tags, non-`.nsis.zip` archives and missing
  `.sig` assets. Re-running it on an already canonical manifest is idempotent.
- `scripts/repair-updater-release.mjs` performs the one-time repair used above. It
  validates the `latest.json` hash against `checksums-sha256.txt` before editing,
  rewrites only the platform URLs and the single `latest.json` checksum line, and
  supports `--check`.
- `.github/workflows/release.yml` now:
  - refuses to overwrite a published Release and deletes a stale draft before a new
    upload;
  - passes `GITHUB_REPOSITORY` and the tag to the normalizer;
  - rejects any `untagged-` or non-canonical URL before publishing;
  - uploads the `VibeHub-Setup.exe` alias before deleting the versioned Setup;
  - renders a generic bilingual release body from `.github/release-body.md`
    (`scripts/render-release-body.mjs`) instead of a hardcoded version body;
  - after publication, downloads the tagged `latest.json`, the archive and the `.sig`,
    compares signatures, and polls `releases/latest/download/latest.json` until it
    serves the tag version.
- Regression coverage: `tests/updater-release.test.mjs`,
  `tests/updater-repair.test.mjs`, `tests/release-body.test.mjs`,
  `tests/release-migration.test.mjs` and `tests/updater-config.test.mjs`.

## Real upgrade check

An installed public build (`0.2.0-beta.4`, full mode) was upgraded through the in-app
signed updater to `0.2.1`:

- the app found `0.2.1` from the repaired manifest;
- it downloaded and signature-verified the archive;
- the installer replaced the program in place;
- after relaunch the app, executable and Add/Remove Programs report `0.2.1`;
- settings, active account identities, install mode and the RTL app payload were
  preserved.

Limitations: the updater used NSIS Basic UI and required advancing the welcome,
progress and finish pages. Two orphaned RTL injector processes from an earlier session
held `runtime\node.exe`, so Setup stopped with a file-write error and needed a Retry
after those processes were stopped. This is not a clean unattended upgrade. Details and
screenshots are in `output/20261031_updater_upgrade/evidence.md` (not committed).

## Residual risks

- Replacing published assets is not atomic. The old `latest.json` and checksum files
  were backed up locally, and the public files were re-downloaded to verify the result.
  GitHub's asset download count resets for the replaced assets.
- The repair covers `v0.2.0` and `v0.2.1` only. Earlier beta manifests
  (`v0.2.0-beta.5`, `v0.2.0-beta.6`) are outside this scope and were not modified.
  Users of those betas upgrade through the same tagged manifest lookup and are not
  affected by the dead URLs in their old release notes.
- The workflow changes take effect on the next release tag. They are covered by
  contract tests and by the manual HTTP checks above, but have not yet run in a real
  publication.
- `VibeHub-Setup.exe` still has no Windows publisher Authenticode signature. Tauri's
  updater signature is a separate mechanism and does not change the SmartScreen
  publisher identity.
