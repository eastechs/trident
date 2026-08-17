# Third-party credits

Trident itself is licensed under the GNU Affero General Public License v3.0
(see [LICENSE](LICENSE)). It also bundles or adapts the work below, under the
terms noted for each.

Trident's dependencies are declared in [package.json](package.json) and their
license texts ship inside each package under `node_modules/`. This file covers
the pieces that are **copied into this repository** or **compiled into the
distributed application**, where the upstream license text would not otherwise
reach someone holding a built copy of Trident.

---

## shadcn/ui — MIT

The 31 UI primitives in `src/renderer/components/ui/` were generated with
[shadcn/ui](https://ui.shadcn.com), which is designed to be copied into a
project rather than installed as a dependency. They have since been modified
for Trident.

> Copyright (c) 2023 shadcn

Licensed under the MIT License (reproduced below).

## AI Elements — MIT

The 11 chat and streaming components in `src/renderer/components/ai-elements/`
are adapted from [AI Elements](https://ai-sdk.dev/elements) by Vercel, likewise
distributed as copy-in source, and modified for Trident.

> Copyright (c) Vercel, Inc.

Licensed under the MIT License (reproduced below).

## Figtree — SIL Open Font License 1.1

The [Figtree](https://github.com/erikdkennedy/figtree) typeface is imported via
`@fontsource-variable/figtree` in `src/renderer/css/app.css` and is therefore
compiled into the shipped renderer bundle.

> Copyright 2022 The Figtree Project Authors
> (https://github.com/erikdkennedy/figtree)

Licensed under the SIL Open Font License, Version 1.1. The full text is
available at <https://openfontlicense.org> and ships with the package at
`node_modules/@fontsource-variable/figtree/LICENSE`.

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
