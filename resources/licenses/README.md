# Dependency and copied-source notices

`npm run notices` uses the committed lockfile and installed production packages
to generate the app's offline legal documents. Run it after `npm ci`; `npm run
build` and `npm run dev` run it automatically. Generated files are ignored and
bundled by Vite into `dist/renderer/legal/`.

`audit.json` records version-specific exceptions for npm packages that omit
license text or metadata. Vendored upstream texts retain their source URL and
Git blob ID. Where a published commit no longer resolves, the license was checked
against the package's declared SPDX license and retrieved from upstream's current
repository. `lazy-val` supplies only an MIT declaration and author metadata;
its clearly identified downstream notice reproduces those terms without inventing
an upstream copyright notice. Fastdom and Strictdom publish their full license
inside README.md; those sections are preserved with a SHA-256 digest instead of
an upstream Git blob ID.

The reviewed production license families are listed in `reviewedLicenses`.
Dependencies with alternative licenses may use the Apache-2.0 option for
`MPL-2.0 OR Apache-2.0`, BSD-3-Clause for `AFL-2.1 OR BSD-3-Clause`, and MIT
for `MIT OR CC0-1.0`. Preserve all supplied notices. Figtree remains OFL-1.1;
fonts are bundled unchanged and are not sold separately. CC-BY attribution and
the Python-2.0 notices are preserved from their packages. Electron's full Chromium
notices are bundled separately from its MIT license.

Copied shadcn/ui and AI Elements notices are listed separately. The latter is
Apache-2.0 and includes both Vercel's copyright notice and the full Apache terms.
Adapted files carry modification notices. Trident's own license does not replace
third-party licenses. The application icon and brand terms are in `TRADEMARK.md`.

After dependency changes, rerun generation and inspect new or changed license
declarations and bundled assets. Missing licenses and new license expressions
fail the build. Optional packages for other operating systems are omitted only
when absent from the installation; their notices are included on builds that
install them. Inspect the final package as well as the generated inventory.
