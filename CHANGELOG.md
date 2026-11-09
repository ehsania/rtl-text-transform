# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `effects.goo.maxBlur` to cap the goo blur in pixels.

### Changed

- The default goo blur cap is now 40px instead of 100px, which cuts the most expensive frames.
- The host font size is cached per morph instead of read on every animation frame.
- Goo and rise blur are combined into a single blur pass per element.
- Fully transparent layers skip their blur.
- Redundant inline style writes are skipped when the value has not changed.
- Chunk spans no longer promote themselves for filter changes via `will-change`.

### Fixed

- `play()` no longer starts automatic cycling when `autoplay` is disabled.
- Playground examples animate again after switching to another example and back.

## [0.1.0] - 2026-11-08

### Added

- Zero-dependency vanilla core with `createMorph`.
- Goo effect: per-layer blur, opacity and a reference-counted SVG alpha threshold.
- Rise effect: changed-hunk travel, scale and motion blur with FLIP for matched text.
- Content presets (`numbers`, `wordsHorizontal`, `wordsUp`, `wordsDown`) and motion presets
  (`default`, `smooth`, `snappy`, `gentle`).
- Per-hunk flow resolvers and numeric flow helpers.
- RTL-aware atomization using `Intl.Segmenter`, Unicode joining forms, lam-alef grouping,
  ZWNJ handling and ZWJ padding.
- Configurable easing, including a zero-dependency `cubicBezier` helper.
- Optional React hook (`useMorph`) and component (`MorphText`) at `rtl-text-transform/react`.
- Accessibility support: aria-hidden layers, a polite live region and reduced-motion handling.
- ESM, CJS and TypeScript declaration builds.
- Landing page and interactive playground.

[0.1.0]: https://github.com/ehsania/rtl-text-transform/releases/tag/v0.1.0
