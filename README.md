# rtl-text-transform

[![npm version](https://img.shields.io/npm/v/rtl-text-transform.svg)](https://www.npmjs.com/package/rtl-text-transform)
[![CI](https://github.com/ehsania/rtl-text-transform/actions/workflows/ci.yml/badge.svg)](https://github.com/ehsania/rtl-text-transform/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/rtl-text-transform.svg)](./LICENSE)
[![zero dependencies](https://img.shields.io/badge/runtime_dependencies-0-brightgreen.svg)](./package.json)

[Live demo](https://ehsania.github.io/rtl-text-transform/) · [Playground](https://ehsania.github.io/rtl-text-transform/playground/) · [npm](https://www.npmjs.com/package/rtl-text-transform)

A tiny, framework-agnostic TypeScript library for text morphs that preserve Arabic-script shaping, Persian joins, ZWNJ and ligatures.

Two effects share one clock and compose freely:

- **Goo** dissolves complete text layers into each other with per-layer blur, opacity and an SVG alpha threshold.
- **Rise** keeps matched runs static and crisp while changed hunks travel, scale and blur into place.

```text
morph  progress = easeInOutCubic(elapsed / morphTime)

goo    blur    = min(blurEm × fontSizePx × (1 / fraction − 1), 100px)
goo    opacity = fraction ^ 0.4
goo    alpha   = 255 × sourceAlpha − threshold

rise   p       = easeOutCubic(local progress)
rise   offset  = travel × (1 − p) along flow
rise   scale   = 1 − (1 − scale) × (1 − p)
rise   blur    = blurEm × (1 − p)
```

The library uses zero runtime dependencies. It atomizes text with `Intl.Segmenter`, Unicode joining-form logic and a small relationship diff — not HarfBuzz or a font shaper. The browser still shapes every rendered run, so joins, contextual forms, ZWNJ and the common lam-alef ligature are preserved. See [Diff and shaping tradeoffs](#diff-and-shaping-tradeoffs).

## Features

- Two independently toggleable effects: `goo` and `rise`.
- All four combinations work: goo only, rise only, both, or a plain fade.
- Only changed hunks rise; matched text stays crisp and glides with FLIP.
- Ease-in-out morph progress and ease-out hunk motion by default.
- Separate easing curves for the overall morph and rise hunks, with a zero-dependency cubic-bezier helper.
- One shared `morphTime`; rise stagger is scaled to fit inside it.
- Zero runtime dependencies.
- Vanilla core plus optional React hook and component.
- Content and motion presets, with per-hunk flow resolvers.
- ESM + CJS + TypeScript declarations.
- No DOM access at import time.
- One `requestAnimationFrame` loop per instance, paused when hidden or offscreen.
- Respects `prefers-reduced-motion`.
- Reference-counted SVG filters with deterministic cleanup.

## Install

```sh
npm install rtl-text-transform
```

React is optional and only needed for the `./react` entry point:

```sh
npm install react
```

## Quick start

```ts
import { createMorph } from "rtl-text-transform";

const el = document.querySelector<HTMLElement>("#morph");
if (!el) throw new Error("Missing #morph");

const morph = createMorph(el, {
  words: ["کتاب", "کتابی", "کتاب‌ها", "کتاب‌هایم"],
  dir: "rtl",
  lang: "fa",
  morphTime: 1,
  restTime: 0.25,
  effects: {
    goo: { blur: 0.075, threshold: 140 },
    rise: { travel: 0.3, stagger: 35 },
  },
});

// Later:
morph.setText("سلام");
morph.pause();
morph.play();
morph.destroy();
```

The library default is **goo on, rise off**:

```ts
const gooOnly = createMorph(el, { words });
```

To compose both effects explicitly:

```ts
const combined = createMorph(el, {
  words,
  effects: {
    goo: true,
    rise: {
      blur: 0.1,
      travel: 0.3,
      scale: 0.94,
      stagger: 35,
      overlap: 0.15,
      flow: "up",
    },
  },
});
```

The host element supplies typography. Set `font-family`, `font-size`, `font-weight` and `color` on it:

```html
<div
  id="morph"
  dir="rtl"
  lang="fa"
  style="font-family: Vazirmatn, system-ui, sans-serif; font-size: 104px; font-weight: 800"
>
  کتاب
</div>
```

The library inherits those values and forces `letter-spacing: 0` on its layers. Existing host children are replaced while the morph is alive and restored on `destroy()`. The element is treated as a dedicated container.

### Sizing and filter clipping

An SVG filter has a filter region. Arabic dots, ascenders and descenders can sit well outside the em box, especially at heavy weights.

The library:

- sets `min-height: 1.6em` only when the computed min-height is still zero/auto;
- turns a computed `display: inline` host into a block with `width: 100%`, because absolute layers need a width;
- uses a generous filter region (`-25% -35% 150% 170%`);
- leaves `overflow` untouched.

For very tall marks, long rise travel or unusual fonts, add breathing room to the host:

```css
#morph {
  min-height: 2em;
  padding: 0.2em 0.1em;
  overflow: visible;
}
```

Do not clip the host with `overflow: hidden` if glyphs or rise motion extend outside its box. The stage around it may clip; the host itself should not.

## Presets

Presets are plain option bundles. The quickest setup is a content preset plus a motion preset:

```ts
import { createMorph } from "rtl-text-transform";

const morph = createMorph(el, {
  preset: "numbers",
  motion: "default",
  words: ["۳", "۴"],
  dir: "rtl",
  lang: "fa",
});
```

Presets never set the content itself. Pass `words`, `dir`, `lang`, `autoplay` and callbacks yourself.

### Content presets

| Preset            | Effects    | Flow             | Values                                                                                     |
| ----------------- | ---------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `numbers`         | goo + rise | numeric auto     | goo `blur 0.1`, `threshold 70`, `atRest false`; rise `blur 0.1`, `travel 0.6`, `scale 0.9` |
| `wordsHorizontal` | goo + rise | per changed hunk | goo `0.1 / 70 / false`; rise `blur 0.04`, `travel 0.24`, `scale 0.96`                      |
| `wordsUp`         | goo + rise | `up`             | same word values                                                                           |
| `wordsDown`       | goo + rise | `down`           | same word values                                                                           |

`numbers` compares the first numeric value: increase → `up`, decrease → `down`, equal or unparseable → `up`. Persian, Arabic-Indic and Latin digits are supported.

For a rise-only number morph, override the effect branch:

```ts
createMorph(el, {
  preset: "numbers",
  motion: "default",
  effects: { goo: false },
});
```

### Motion presets

| Motion    | `morphTime` | Rise easing          | `stagger` | `overlap` |
| --------- | ----------- | -------------------- | --------- | --------- |
| `default` | `0.3`       | `easeOutCubic`       | `70ms`    | `0`       |
| `smooth`  | `0.8`       | smooth decelerating  | `30ms`    | `0.18`    |
| `snappy`  | `0.2`       | sharper decelerating | `50ms`    | `0`       |
| `gentle`  | `1.1`       | slow in-out          | `45ms`    | `0.2`     |

When `preset` is supplied and `motion` is omitted, `motion: "default"` is used.

### Fine-tuning

Inline options always win. Nested effect objects merge:

```ts
createMorph(el, {
  preset: "numbers",
  motion: "gentle",
  effects: {
    rise: { blur: 0.14, travel: 0.75 },
  },
});
```

Use `false` to disable an effect branch. Use `true` to re-enable it with the library defaults.

The resolved preset values are inspectable:

```ts
import { motions, presets, resolvePreset } from "rtl-text-transform";

presets.numbers;
motions.snappy;
console.log(resolvePreset("numbers", { motion: "snappy" }));
```

### Per-hunk flow

`effects.rise.flow` accepts a fixed direction or a resolver:

```ts
interface RiseFlowContext {
  from: string;
  to: string;
  dir: "rtl" | "ltr" | "auto";
  rtl: boolean;
  hunk: {
    id: string;
    kind: "add" | "remove";
    text: string;
    start: number;
    end: number;
    length: number;
    position: number; // 0 at the start, 1 at the end
  };
}
```

The resolver runs once per changed hunk when a morph starts, so a word can have a prefix hunk move one way and a suffix hunk move the other. The exported `flowByHunkPosition` and `flowByNumberChange` helpers are the functions used by the word and number presets.

`wordsHorizontal` moves each hunk toward the edge it belongs to. RTL maps start → `right` and end → `left`; LTR maps start → `left` and end → `right`. An exactly centred hunk uses the end side.

Presets are resolved at creation and whenever `update()` receives `preset` or `motion`. Inline options in the same call are applied after the preset.

## Options

`createMorph(el, options?)` accepts:

| Option         | Type                       | Default                   | Description                                                                                               |
| -------------- | -------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `words`        | `string[]`                 | `[]`                      | Optional auto-cycling list. The first entry is shown immediately.                                         |
| `preset`       | `PresetName`               | —                         | Content preset: `numbers`, `wordsHorizontal`, `wordsUp`, `wordsDown`.                                     |
| `motion`       | `MotionName`               | `"default"` with a preset | Motion preset: `default`, `smooth`, `snappy`, `gentle`.                                                   |
| `morphTime`    | `number`                   | `1`                       | Length of one morph in seconds. `0` applies instantly.                                                    |
| `restTime`     | `number`                   | `0.25`                    | Rest after a morph before the next automatic one, in seconds.                                             |
| `effects`      | `MorphEffects`             | `{ goo: true }`           | Nested effect options. Goo defaults on; rise defaults off.                                                |
| `dir`          | `"rtl" \| "ltr" \| "auto"` | host value                | Sets `dir` on the container.                                                                              |
| `lang`         | `string`                   | host value                | Sets `lang` on the container.                                                                             |
| `autoplay`     | `boolean`                  | `true`                    | Start cycling `words` automatically.                                                                      |
| `loop`         | `boolean`                  | `true`                    | Wrap from the last word to the first. When false, auto-cycling stops at the last word.                    |
| `easing`       | `(t: number) => number`    | `easeInOutCubic`          | Timing curve for overall morph progress and matched-text FLIP. Pass `t => t` for linear. Must return 0–1. |
| `onMorphStart` | `(from, to) => void`       | —                         | Called when a morph starts, including the morph that follows a fast-forward.                              |
| `onMorphEnd`   | `(from, to) => void`       | —                         | Called when a morph reaches its target.                                                                   |

`words` is rest-first, matching the original demo: rest on the current word, then morph to the next.

### `effects`

Each effect accepts `boolean` or an options object. An object enables the effect and merges with that effect's defaults.

```ts
interface MorphEffects {
  goo?: boolean | GooEffectOptions;
  rise?: boolean | RiseEffectOptions;
}
```

#### Goo options

| Option      | Type      | Default | Description                                                                                                |
| ----------- | --------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| `blur`      | `number`  | `0.075` | Layer blur strength in `em`, scaled by the host's computed font size.                                      |
| `maxBlur`   | `number`  | `40`    | Upper bound for the goo blur in pixels. Clamped to 0–100. Lower values are cheaper to render.              |
| `threshold` | `number`  | `140`   | The `T` in the alpha row `0 0 0 255 -T`. Clamped to 0–255.                                                 |
| `atRest`    | `boolean` | `true`  | Apply the goo CSS filter while the text is at rest. When false, the filter is only applied during a morph. |

#### Rise options

| Option              | Type                    | Default        | Description                                                                                                                                                                                                                                                             |
| ------------------- | ----------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `blur`              | `number`                | `0.1`          | Motion blur at the start of an entering hunk, in `em`.                                                                                                                                                                                                                  |
| `travel`            | `number`                | `0.3`          | Vertical travel in `em`.                                                                                                                                                                                                                                                |
| `scale`             | `number`                | `0.94`         | Scale at the start of an entering hunk. Clamped to 0–1.                                                                                                                                                                                                                 |
| `stagger`           | `number`                | `35`           | Requested delay between neighbouring hunks, in milliseconds. Scaled down when needed to fit `morphTime`.                                                                                                                                                                |
| `overlap`           | `number`                | `0.15`         | Fraction of the entering window that overlaps the outgoing hunk. Clamped to 0–1.                                                                                                                                                                                        |
| `easing`            | `(t: number) => number` | `easeOutCubic` | Timing curve for each hunk's enter and exit progress. Must return 0–1.                                                                                                                                                                                                  |
| `flow`              | `RiseFlowValue`         | `"up"`         | Travel direction. A fixed direction, or a resolver called once per changed hunk. `up`: outgoing hunks leave upward and new hunks arrive from below. `left`: outgoing hunks leave left and new hunks arrive from the right. `down` and `right` reverse those directions. |
| `minChunk`          | `number`                | `2`            | Matched runs shorter than this are treated as changed unless they are a whole word.                                                                                                                                                                                     |
| `normalizeVariants` | `boolean`               | `true`         | Treat Arabic/Persian kaf and yeh variants as equal while diffing.                                                                                                                                                                                                       |
| `ignoreDiacritics`  | `boolean`               | `true`         | Do not let combining marks prevent a match. Rendered text still keeps the marks.                                                                                                                                                                                        |

`normalizeVariants` and `ignoreDiacritics` affect diff equality only. They never rewrite the text that the browser shapes or renders.

## Effect combinations

| `goo`   | `rise`  | Behavior                                                                                                                                                                    |
| ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `true`  | `false` | Two full text layers blur and cross-fade through the SVG threshold. The host gets `url(#…) blur(0.6px)` for a softer threshold edge.                                        |
| `false` | `true`  | Changed hunks rise, scale and motion-blur. Matched chunks stay static and crisp. No SVG filter is created.                                                                  |
| `true`  | `true`  | Changed hunks receive **both** the goo blur curve and rise motion blur. Matched chunks stay crisp. The host keeps the threshold but omits the extra `blur(0.6px)` softener. |
| `false` | `false` | A short opacity cross-fade.                                                                                                                                                 |

Rise transitions omit the extra host softener so matched chunks stay crisp.

### Motion and easing

Motion is not linear by default:

- The overall morph, goo progress and matched FLIP use **ease-in-out cubic**. The dissolve starts gently, accelerates through the middle and settles at the end.
- Changed rise hunks use **ease-out cubic**. They start moving immediately and settle into place instead of arriving at a constant speed.
- `easing` controls the overall morph and matched FLIP. `effects.rise.easing` controls hunk motion independently.
- The package exports `linear`, `easeOutCubic`, `easeInOutCubic` and `cubicBezier` so the same curves can be inspected or reused.
- Custom easing functions must return a value from 0 to 1. Reduced motion replaces the goo/rise motion with a short opacity cross-fade.

```ts
import { createMorph, cubicBezier, easeOutCubic } from "rtl-text-transform";

createMorph(el, {
  easing: cubicBezier(0.65, 0, 0.35, 1),
  effects: {
    rise: {
      easing: easeOutCubic,
    },
  },
});
```

### Interruptions

- **Goo-only:** a new target starts immediately from the dominant current visual state, without a jump.
- **Rise or combined:** the running morph fast-forwards in roughly `0.12s` (or one frame for short morphs), then the latest queued target starts. Intermediate queued targets are dropped; their promises resolve.

`setText()` never disables automatic cycling. Call `pause()` or `update({ autoplay: false })` if a custom string should stay put.

## API

```ts
interface Morph {
  setText(text: string): Promise<void>;
  next(): Promise<void>;
  setWords(words: string[]): void;
  play(): void;
  pause(): void;
  destroy(): void;
  update(partialOptions: Partial<MorphOptions>): void;
}
```

- **`setText(text)`** morphs from the current visual state. If a goo-only morph is running, the winning layer keeps its exact current opacity and blur, so the new morph does not jump. A rise or combined morph fast-forwards first.
- **`next()`** advances one entry in `words`. It returns a resolved promise when there is nowhere to go (no words, or `loop: false` at the end).
- **`setWords(words)`** replaces the list. The current reference text is kept if it is still in the list; otherwise the index resets to zero.
- **`play() / pause()`** resume or freeze the animation clock and automatic cycling. While paused, `setText()` and `next()` apply immediately instead of animating, so calls never hang.
- **`update(partial)`** changes options in place. Nested effect patches merge with current values, so `update({ effects: { rise: { stagger: 60 } } })` keeps the other rise settings. Changing the goo threshold releases and re-acquires the shared SVG filter.
- **`destroy()`** cancels the loop, removes listeners and the filter reference, removes the layers and live region, and restores the host's original children, `dir`/`lang`, and touched inline styles. Safe to call twice.

## React

The React entry point is thin and optional. React is a peer dependency.

### Component

```tsx
import { MorphText } from "rtl-text-transform/react";

export function Hero() {
  return (
    <MorphText
      words={["کتاب", "کتابی", "کتاب‌ها", "کتاب‌هایم"]}
      dir="rtl"
      lang="fa"
      morphTime={1}
      restTime={0.25}
      effects={{
        goo: { blur: 0.075, threshold: 140 },
        rise: { travel: 0.3, stagger: 35 },
      }}
      style={{
        fontFamily: "Vazirmatn, system-ui, sans-serif",
        fontSize: "clamp(48px, 13vw, 148px)",
        fontWeight: 800,
      }}
    />
  );
}
```

`MorphText` uses `div` by default; pass `as="span"` or another element type. Do not pass children: use `text` for a controlled string or `words` for a cycling list. `text` changes call `setText()`.

Presets are forwarded as props too:

```tsx
<MorphText preset="numbers" motion="snappy" words={["۳", "۴"]} dir="rtl" lang="fa" />
```

### Hook

```tsx
import { useMorph } from "rtl-text-transform/react";

function Morph() {
  const { ref, morph } = useMorph({
    words: ["سلام", "درود", "خوش آمدید"],
    dir: "rtl",
    lang: "fa",
    effects: { goo: true, rise: true },
  });

  return (
    <>
      <span ref={ref} style={{ fontSize: 96, fontWeight: 700 }} />
      <button onClick={() => morph?.next()}>Next</button>
    </>
  );
}
```

Options are forwarded to `update()` without recreating the instance. The hook also returns `setText`, `next`, `setWords`, `play` and `pause` bound to the current instance.

## Arabic, Persian and RTL notes

- **Rendered shaping is preserved.** The browser shapes each rendered chunk. The diff only decides which source ranges stay together.
- **Contextual forms are compared.** An atom key includes Unicode joining forms, so a letter that changes from final to medial is not treated as unchanged.
- **Lam-alef is one atom.** The common Persian/Arabic lam-alef relationship stays in one rendered span.
- **ZWNJ breaks joining.** Persian compounds such as `می‌خواهم` keep their ZWNJ and their final/isolated forms; changed hunks do not span the break.
- **ZWNJ does not block an otherwise identical shape.** If a letter has the same contextual form on both sides of a ZWNJ, the diff matches it; the invisible join control alone never forces it to animate.
- **ZWJ padding preserves chunk edges.** When a chunk boundary falls inside a joined run, a zero-width joiner forces the correct contextual form at the edge so the chunk still connects visually.
- **Letter-spacing is forced to zero** on layers and chunks with `!important`. Positive tracking disconnects Arabic joins.
- **Set `dir` and `lang`.** Pass `dir: "rtl"` and `lang: "fa"` or `"ar"` (or set them on the host). `dir: "auto"` lets the browser decide from the first strong character.
- **Font weight matters for goo.** The alpha threshold rounds pixel coverage to on/off. Thin strokes, dots and small diacritics can erode. Try weight 600–800, a lower threshold (110–140), or less blur.
- **Do not use positive `word-spacing`** for the same reason as letter-spacing. The library leaves `word-spacing` inherited.
- **Avoid transform scaling** on the host during a morph. The computed font size is sampled for blur and travel, and CSS transforms do not change it.

## Diff and shaping tradeoffs

This library deliberately avoids a font-shaping dependency such as HarfBuzz.

Atomization uses:

1. `Intl.Segmenter` grapheme clusters (with a combining-mark fallback);
2. Unicode-based joining-form signatures derived from neighbouring letters;
3. lam-alef grouping for the common Arabic/Persian relationship;
4. a longest-common-subsequence atom diff with optional kaf/yeh and diacritic normalization;
5. changed-hunk construction that splits after whitespace but keeps ZWNJ compounds together;
6. ZWJ padding at internal chunk edges.

The consequence: a font-specific ligature that is not identifiable from Unicode alone cannot always be predicted. Rare ligatures may animate as changed text instead of staying fixed. Common Arabic/Persian shaping, joins, ZWNJ and lam-alef are handled. This is the cost of staying fully zero-dependency.

## Performance

- The host font size is read once per morph, not on every animation frame.
- Transparent layers skip their blur entirely.
- Goo and rise blur are composed into one blur pass per element.
- The goo blur is capped by `effects.goo.maxBlur` (40px by default). Raise it for a softer look, lower it for heavy pages.
- Use `effects.goo.atRest: false` when many morphs share a page.

## Accessibility

- Both animated layers are `aria-hidden="true"`.
- One visually hidden copy of the current target text stays in the container with `aria-live="polite"` and `aria-atomic="true"`.
- The live copy updates when a morph starts, so screen readers hear the new word once.
- `prefers-reduced-motion: reduce` switches to a short opacity cross-fade (max 0.18s), with no blur, no rise and no SVG threshold.
- `pause()` freezes the clock; `play()` resumes it.

## SSR

Importing the package is safe on the server: no DOM access happens at module load. `createMorph` and the React hook must run in a browser after mount. The React component has no server-rendered text; use the vanilla container plus a `<noscript>` fallback if the text must be visible before hydration.

## Known limitations

- **Thin strokes and dots in goo mode.** The threshold is a hard alpha cutoff. At low font weights, Arabic dots and fine diacritics can vanish. The effect works best on heavy display weights. `effects.goo.atRest: false` keeps the crisp original at rest.
- **Rise needs a usable diff.** Completely unrelated strings have no matched chunks, so everything rises together. Gradual phrase changes show the effect best.
- **Font-specific ligatures.** See [Diff and shaping tradeoffs](#diff-and-shaping-tradeoffs).
- **One host filter.** If the host already has a CSS `filter`, the library overrides it while active and restores the inline value on `destroy()`.
- **`filter` scale is not accounted for.** Blur uses the computed font size in CSS pixels. A parent `transform: scale()` scales the result but not the blur amount.
- **Long strings do not wrap.** Layers use `white-space: nowrap`. Size the host for the longest phrase, or shorten the list.
- **Blur is capped at `maxBlur`** (40px by default, hard maximum 100px). Lower it further on low-powered devices or when many morphs share a page.
- **Rest-first timing.** Auto-cycling waits `restTime` before the first morph and after every completed morph.
- **No font loading management.** Use `font-display` and wait for `document.fonts.ready` if the morph must begin after a webfont loads.

## Development

```sh
npm install
npm run dev          # landing at http://localhost:5173/ and playground at /playground/
npm test             # Vitest
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run format       # Prettier
npm run build        # typecheck + tsup (ESM/CJS/d.ts) + Vite site build
npm run build:lib    # package only
```

The source layout is:

```text
src/core/options.ts       public types, defaults and patch merging
src/core/easing.ts        cubic-bezier solver and default motion curves
src/core/atoms.ts         grapheme atoms, joining forms, lam-alef
src/core/diff.ts          zero-dependency LCS atom diff
src/core/chunks.ts        changed-hunk construction and min-chunk merging
src/core/effects/rise.ts  rise timing and transforms
src/core/transition.ts    transition state, easing helpers and per-hunk flow
src/core/scene.ts         shaped chunk rendering, ZWJ padding, FLIP
src/core/layers.ts        layer shells, inner lines and live region
src/core/controller.ts    state machine, rAF, effect composition, interruption
src/core/filter.ts        reference-counted shared SVG filters
src/core/math.ts          shared goo math, unit-tested
src/index.ts              vanilla entry
src/react.tsx             hook + component wrapper
demo/                     landing page + playground, rebuilt on the library
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

MIT
