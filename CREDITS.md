# Third-party credits

Trident itself is licensed under the GNU Affero General Public License v3.0
(see [LICENSE](LICENSE)). It also bundles or adapts the work below, under the
terms noted for each.

Trident's dependencies and exact versions are declared in [package.json](package.json)
and [package-lock.json](package-lock.json). `npm run notices` generates a
dependency inventory and full license notices for installed production packages,
copied components, fonts, and Electron. These are bundled in the app and accessible
offline from About and Documentation → Open Source, alongside Chromium's notices.

Some npm packages omit their license files. Available upstream texts are preserved in
[`resources/licenses/`](resources/licenses/) with package versions, source URLs,
and Git blob hashes in `audit.json`. The `lazy-val` notice instead reproduces MIT
terms based on its published license declaration and author metadata, as recorded
in the audit. The build fails for missing license texts or
unreviewed license metadata. Development tools are not represented as runtime
dependencies; their original licenses remain in the installed development tree.

---

## shadcn/ui — MIT

The UI primitives in `src/renderer/components/ui/` were generated with
[shadcn/ui](https://ui.shadcn.com), which is designed to be copied into a
project rather than installed as a dependency. They have since been modified
for Trident.

> Copyright (c) 2023 shadcn

Licensed under the MIT License (reproduced below).

## AI Elements — Apache License 2.0

The chat and streaming components in `src/renderer/components/ai-elements/`
are adapted from [AI Elements](https://ai-sdk.dev/elements) by Vercel, likewise
distributed as copy-in source, and modified for Trident.

> Copyright 2023 Vercel, Inc.

These components have been modified for Trident and remain subject to their
[Apache-2.0 license](https://github.com/vercel/ai-elements/blob/main/LICENSE).
The upstream notice and full Apache license are included in the bundled notices.

## Figtree — SIL Open Font License 1.1

The [Figtree](https://github.com/erikdkennedy/figtree) typeface is imported via
`@fontsource-variable/figtree` in `src/renderer/css/app.css` and is therefore
compiled into the shipped renderer bundle.

> Copyright 2022 The Figtree Project Authors
> (https://github.com/erikdkennedy/figtree)

Licensed under the SIL Open Font License, Version 1.1. The full text is
available at <https://openfontlicense.org> and ships with the package at
`node_modules/@fontsource-variable/figtree/LICENSE` and in the bundled notices.

## Other assets and runtime

The Trident application icon and brand artwork are original Eastechs assets;
see [TRADEMARK.md](TRADEMARK.md) for their separate terms. The application
screenshot depicts Trident itself.

The notification sounds `src/audio/agent-chime-1.mp3` and
`src/audio/agent-chime-2.mp3` are original compositions by Dave Sebek and are
distributed under Trident's AGPL-3.0-only license.

Electron's MIT license and the licenses of its Chromium dependencies are bundled
with the runtime and copied into the app's offline legal documents. Other runtime
dependencies retain their upstream licenses; the generated inventory records each
installed package and version, including dependencies compiled into the renderer.

---

## MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
