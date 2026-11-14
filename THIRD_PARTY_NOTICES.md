# Third-party notices

NEWS RADAR's original application code is licensed under MIT, copyright NEWS RADAR contributors. Third-party code, fonts, data and models retain their own licenses and copyright notices. The application may be MIT while using these components, provided the applicable third-party terms and notices are retained. This document does **not** relicense dependencies, model weights, publisher articles, feed data, user posts or translations as MIT.

The source repository does not vendor `node_modules`, Python environments or translation model binaries. Installing dependencies, building browser assets or distributing a container introduces additional third-party material. Retain the legal files shipped by those dependencies and include the relevant notice files with distributed artifacts. Package labels are an index to the terms, not a replacement for the actual copyright/license/NOTICE texts.

## Inventory and notice texts

- [Dependency inventory](third-party/inventory.json): all 247 third-party package-lock entries, installed-version notice references, Python requirements, pinned model declarations and bundled-component notes. Optional packages for other operating systems have metadata-only evidence where no installed copy was available.
- [npm notice copies](third-party/licenses/npm/): available installed package license texts, README notices, Apache NOTICE files and bundled third-party notices, including Prettier, TypeScript and Playwright sidecars.
- [Python notice copies](third-party/licenses/python/): available wheel notices and version-pinned upstream license supplements for the optional translation runtime.
- [License reference texts](third-party/licenses/common/): common terms, including CC-BY-4.0, GPL-3.0 and the GCC Runtime Library Exception 3.1. Package-specific copyright and attribution notices still apply.
- [Supplemental source references and hashes](third-party/supplemental-sources.json) and [wheel SBOM evidence](third-party/sboms/).
- [Model attribution](third-party/MODEL_ATTRIBUTION.md): separately downloaded, pinned translation models and their provenance.

This inventory was checked on 14 November 2026. It is not an operating-system or complete container SBOM. Dependency versions and platform wheels change; update notices and review the actual artifacts before redistributing a new build. Third-party author names present in license texts are retained because those notices belong to the original licensors.

## Frontend code, fonts and icons

The browser application uses React/React DOM and other code principally under MIT, plus Lucide icons under ISC with Feather-derived portions under MIT. Preserve each applicable copyright and permission notice in the browser distribution's accompanying legal materials. [MIT](https://opensource.org/license/mit) and [ISC](https://opensource.org/license/isc) require notice retention; a link to this summary alone is not a substitute for copied notices where the license requires the text.

**Inter, `@fontsource/inter` 5.3.0, is SIL OFL 1.1.** Copyright 2016 The Inter Project Authors. The font may be bundled with MIT software, but the font itself remains OFL. Include its copyright and full OFL text with distributed font files. Respect applicable reserved font names when modifying fonts and do not sell the font by itself. Application documents do not become OFL merely by using Inter. [Inter license copy](third-party/licenses/npm/fontsource_inter@5.3.0/LICENSE), [OFL authoritative text](https://openfontlicense.org/open-font-license-official-text/).

**Lucide React 0.468.0 is ISC**, with a notice crediting Lucide Contributors and Cole Bemis/Feather MIT portions. Preserve the installed package's copyright wording, the ISC permission text and the Feather MIT text when redistributing those icons. [Installed Lucide license](third-party/licenses/npm/lucide-react@0.468.0/LICENSE), [Feather MIT license](third-party/licenses/npm/lucide-react@0.468.0/FEATHER-MIT-LICENSE), [Lucide license reference](https://lucide.dev/license). Current upstream website copyright dates do not replace the installed release's notices.

## Build and development dependencies

The dependency lock contains MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, BlueOak-1.0.0, 0BSD, MPL-2.0, OFL-1.1 and CC-BY-4.0 entries. Their complete texts and component-specific notices are retained where available in this notice collection. Permissive code can coexist with MIT application code while retaining its separate terms. BSD terms include preservation of copyright/conditions/disclaimers and, for the three-clause form, a prohibition on implied endorsement. Blue Oak requires its license text or a permitted license link. 0BSD applies to the recorded tslib component in the optional WASM toolchain.

**LightningCSS 1.33.0 and platform bindings are MPL-2.0.** They are build dependencies. Using the tool does not relicense unrelated application files or generated CSS. When distributing covered source, retain MPL notices and its source license; when distributing covered binaries/libraries, tell recipients how to obtain the covered source under MPL. Keep modified covered files under the applicable MPL obligations. [MPL text](third-party/licenses/common/MPL-2.0.txt), [Mozilla guidance](https://www.mozilla.org/en-US/MPL/2.0/FAQ/). This repository's dependency references are not a blanket source offer for every binary someone may build or download.

**Apache-2.0 components** require their license text, applicable copyright/attribution and any supplied NOTICE content, and prominent notices in changed files when applicable. The Apache terms permit original application code under MIT while the original components retain their terms. Playwright's NOTICE credits Microsoft and Puppeteer-derived code. Preserve `NOTICE`, `ThirdPartyNotices.txt` and `lib/*.LICENSE` if redistributing Playwright tooling. [Apache authoritative text](https://www.apache.org/licenses/LICENSE-2.0).

**TypeScript 5.9.3** is Apache-2.0 and includes a separate `ThirdPartyNoticeText.txt` with MIT, Unicode data/software and WHATWG CC-BY-4.0 material. Preserve that full notice when shipping the tool; the Apache package label does not supersede it. **caniuse-lite 1.0.30001826** contains CC-BY-4.0 browser-support data. Where that licensed material is shared, retain supplied attribution and license information and identify changes. These build-time components do not automatically make generated application code CC-BY.

**Prettier 3.10.1** is MIT and includes 246 bundled-component notice entries, with MIT, ISC, BSD, Apache and Blue Oak terms. Preserve `THIRD-PARTY-NOTICES.md` when redistributing the tool. Bundled-component counts are not a count of unique additional installed dependencies.

Some platform npm packages omit standalone license files. The inventory identifies same-version parent-project notices where available, and records README-linked license evidence. If distributing optional/native packages not represented by a complete notice set, obtain the appropriate upstream notices for that exact artifact first. A source-only package manifest referencing an external dependency does not include that dependency's binary.

## Optional Python translation runtime and native libraries

The required versions are CTranslate2 4.9.0 (MIT), SentencePiece 0.2.3 (Apache-2.0), NumPy 2.5.4 (BSD-3-Clause and additional bundled licenses) and PyYAML 6.0.3 (MIT). Python environments and wheels are installed separately. Version-pinned upstream CTranslate2 and SentencePiece license copies supplement wheels that omit standalone legal files. Preserve installed `.dist-info/licenses`, SBOM files and other bundled legal files in any translation container or runtime distribution. Installer tooling such as pip has its own vendored licenses too.

NumPy's audited metadata lists `BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0`; its actual wheel LICENSE also identifies OpenBLAS (BSD-3-Clause), LAPACK (BSD-3-Clause-Open-MPI), and libgfortran (GPL-3.0-or-later WITH GCC-exception-3.1). The audited x86_64 CTranslate2 and SentencePiece wheels include libgomp; their auditwheel SBOMs identify GCC 8.5.0 runtime packages. Other platform wheels or image bases may differ.

The **GCC Runtime Library Exception 3.1** permits eligible combinations of runtime code with independent modules under chosen terms. It does not turn the runtime into MIT or remove the runtime's own distribution obligations. The exception does not require the original NEWS RADAR application code to become GPL. Retain the [GPL text](third-party/licenses/common/GPL-3.0.txt), [exception text](third-party/licenses/common/GCC-exception-3.1.txt), applicable copyright notices and any required corresponding-source provision when distributing those runtime binaries. This repository's notice copies are **not** a complete corresponding-source offer for libgomp, libgfortran or a container image. [GCC licensing reference](https://gcc.gnu.org/onlinedocs/libstdc++/manual/license.html).

A Dockerfile that installs dependencies is source configuration; an image built from it includes the installed dependencies and base-system software. Before publishing an image, retain its actual legal files, review its wheel/native/base-image components, and satisfy applicable source obligations. Merely preserving the package's top-level MIT or Apache label is insufficient for a wheel with additional native components.

## Separately downloaded translation models

The English-to-Portuguese model is CC-BY-4.0 and the multilingual-to-English model is Apache-2.0; exact repositories/revisions and credits are in [MODEL_ATTRIBUTION.md](third-party/MODEL_ATTRIBUTION.md) and `ops/translation-models.json`. Model binaries are not part of the source repository. Retain the downloaded model's license/provenance/attribution files, upstream notices and conversion/quantization information. Do not relabel those weights MIT.

CC-BY-4.0 requires appropriate supplied attribution, a license link and indication of changes when the licensed material is shared; it prohibits additional restrictions on the licensed rights. [CC-BY-4.0 text](third-party/licenses/common/CC-BY-4.0.txt). Apache model materials retain applicable Apache notices. These model terms do not establish rights to input news articles or automatically determine the license of every generated translation.

## Publisher content and service access

RSS and API content, linked articles, source logos, user posts and translations of protected text are outside the application's MIT grant. Public endpoint availability is not permission for unrestricted republication, translation, commercial aggregation or database export. Keep publisher attribution and original links and follow each provider's applicable terms. This project does not provide working Reddit, Facebook or X collectors or promise authorized free access to those services. Source examples/configuration do not convey rights in publisher content.

The versioned [GCC 8.5.0 libgomp header](https://raw.githubusercontent.com/gcc-mirror/gcc/releases/gcc-8.5.0/libgomp/libgomp.h) expressly identifies GPL version 3 or later plus GCC Runtime Library Exception 3.1, supporting the libgomp licensing classification above.
