import { DEFAULT_MORPH_EASING } from "./easing";
import type { EasingFunction } from "./easing";
import {
  enterProgress,
  enterTransform,
  exitProgress,
  exitTransform,
  riseTiming,
} from "./effects/rise";
import { acquireGooFilter } from "./filter";
import type { GooFilterHandle } from "./filter";
import {
  applyFadeState,
  applyGooState,
  clearLayer,
  createStage,
  removeStage,
  resetLayer,
  setLayerText,
  setLiveText,
  sizeHost,
} from "./layers";
import type { MorphStage } from "./layers";
import { blurForFraction, canAdvance, clamp01, opacityForFraction, wrapIndex } from "./math";
import type {
  Morph,
  MorphCallback,
  MorphDirection,
  MorphOptions,
  ResolvedGoo,
  ResolvedRise,
} from "./options";
import { applyGooPatch, applyRisePatch, resolveInitialEffects } from "./options";
import { resolveMorphOptions } from "./presets";
import { buildDiffScene, enterOrder, exitOrder } from "./scene";
import {
  combineBlur,
  DEFAULT_FONT_SIZE,
  FAST_FORWARD,
  flowForTransition,
  GOO_SOFTEN,
  MAX_FRAME_DELTA,
  NO_EFFECT_FADE,
  nonNegative,
  prefersReducedMotion,
  REDUCED_MOTION_FADE,
  reportCallbackError,
  sameWords,
} from "./transition";
import type { PendingMorph, SavedStyle, Transition, TransitionMode } from "./transition";

/**
 * Create a unified RTL text morph attached to `el`.
 *
 * The host is treated as a dedicated container. Its children are replaced by
 * two aria-hidden layers and one visually hidden live region; original content
 * is restored by `destroy()`.
 */
export function createMorph(el: HTMLElement, options: MorphOptions = {}): Morph {
  if (!el || !el.ownerDocument) {
    throw new TypeError("createMorph(el): el must be an HTMLElement");
  }

  const resolvedOptions = resolveMorphOptions(options);
  const doc = el.ownerDocument;
  const originalNodes = Array.from(el.childNodes);
  const originalDir = el.getAttribute("dir");
  const originalLang = el.getAttribute("lang");
  const savedStyle: SavedStyle = {
    position: el.style.position,
    display: el.style.display,
    minHeight: el.style.minHeight,
    width: el.style.width,
    filter: el.style.filter,
  };

  const initialText = (el.textContent ?? "").trim();
  let words = Array.isArray(resolvedOptions.words)
    ? resolvedOptions.words.map((word) => String(word))
    : [];

  const initialEffects = resolveInitialEffects(resolvedOptions.effects);
  let goo: ResolvedGoo = initialEffects.goo;
  let rise: ResolvedRise = initialEffects.rise;

  let morphTime = nonNegative(resolvedOptions.morphTime, 1);
  let restTime = nonNegative(resolvedOptions.restTime, 0.25);
  let dir = resolvedOptions.dir;
  let lang = resolvedOptions.lang;
  let autoplay = resolvedOptions.autoplay ?? true;
  let loop = resolvedOptions.loop ?? true;
  let easing =
    typeof resolvedOptions.easing === "function" ? resolvedOptions.easing : DEFAULT_MORPH_EASING;
  let onMorphStart = resolvedOptions.onMorphStart;
  let onMorphEnd = resolvedOptions.onMorphEnd;
  let currentPreset = options.preset;
  let currentMotion = options.motion;

  if (dir) el.setAttribute("dir", dir);
  if (lang) el.setAttribute("lang", lang);

  let currentText = words.length > 0 ? words[0]! : initialText;
  let wordIndex = 0;
  let auto = autoplay;
  let autoRest: number | null =
    auto && words.length > 1 && canAdvance(wordIndex, words.length, loop) ? restTime : null;
  let paused = false;
  let destroyed = false;
  let hidden = doc.visibilityState === "hidden";
  let offscreen = false;
  let transition: Transition | null = null;
  let pending: PendingMorph | null = null;
  let rafId: number | null = null;
  let lastTimestamp: number | null = null;
  let filter: GooFilterHandle | null = goo.enabled ? acquireGooFilter(goo.threshold, doc) : null;

  sizeHost(el);
  const stage: MorphStage = createStage(el);

  function readFontSize(): number {
    const view = doc.defaultView;
    const computed = view?.getComputedStyle(el).fontSize;
    const parsed = computed ? Number.parseFloat(computed) : Number.NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    const inline = Number.parseFloat(el.style.fontSize);
    return Number.isFinite(inline) && inline > 0 ? inline : DEFAULT_FONT_SIZE;
  }

  function readDirection(): { dir: MorphDirection; rtl: boolean } {
    const attr = dir ?? (el.getAttribute("dir") as MorphDirection | null) ?? "rtl";
    const view = doc.defaultView;
    const computed = view?.getComputedStyle(el).direction;
    const rtl = computed === "rtl" ? true : computed === "ltr" ? false : attr !== "ltr";
    return { dir: attr === "ltr" || attr === "rtl" || attr === "auto" ? attr : "rtl", rtl };
  }

  function applyEasing(curve: EasingFunction, value: number): number {
    try {
      const eased = curve(value);
      return Number.isFinite(eased) ? clamp01(eased) : value;
    } catch {
      return value;
    }
  }

  function ease(value: number): number {
    return applyEasing(easing, value);
  }

  function easeRise(value: number): number {
    return applyEasing(rise.easing, value);
  }

  function renderSettled(text: string): void {
    clearLayer(stage.outgoing);
    clearLayer(stage.incoming);
    setLayerText(stage.outgoing, text);
    setLayerText(stage.incoming, text);
    stage.outgoing.line.style.opacity = "0";
    stage.outgoing.line.style.filter = "none";
    stage.incoming.line.style.opacity = "1";
    stage.incoming.line.style.filter = "none";
    stage.incoming.line.style.transform = "none";
  }

  function syncFilter(): void {
    if (destroyed) return;
    const reduced = prefersReducedMotion(doc);
    const activeGoo =
      transition !== null && (transition.mode === "goo" || transition.mode === "rise");
    const canUseGoo =
      goo.enabled && filter !== null && !reduced && (transition === null ? goo.atRest : activeGoo);

    if (!canUseGoo) {
      el.style.filter = "none";
      return;
    }
    const soften = rise.enabled ? "" : GOO_SOFTEN;
    el.style.filter = `url(#${filter!.id})${soften}`;
  }

  function refreshFilter(): void {
    if (destroyed) return;
    if (!goo.enabled) {
      filter?.release();
      filter = null;
      syncFilter();
      return;
    }
    if (!filter || filter.threshold !== goo.threshold) {
      const next = acquireGooFilter(goo.threshold, doc);
      filter?.release();
      filter = next;
    }
    syncFilter();
  }

  function safeCallback(callback: MorphCallback | undefined, from: string, to: string): void {
    if (!callback) return;
    try {
      callback(from, to);
    } catch (error) {
      reportCallbackError(error);
    }
  }

  function canAutoAdvance(): boolean {
    return canAdvance(wordIndex, words.length, loop);
  }

  function needsLoop(): boolean {
    if (destroyed || paused || hidden || offscreen) return false;
    if (transition) return true;
    return auto && words.length > 1 && canAutoAdvance();
  }

  function requestFrame(): number {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(tick);
    }
    return setTimeout(() => tick(Date.now()), 16) as unknown as number;
  }

  function cancelFrame(id: number): void {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  }

  function stopLoop(): void {
    if (rafId !== null) {
      cancelFrame(rafId);
      rafId = null;
    }
    lastTimestamp = null;
  }

  function syncLoop(): void {
    if (!needsLoop()) {
      stopLoop();
      return;
    }
    if (rafId !== null) return;
    lastTimestamp = null;
    rafId = requestFrame();
  }

  function renderGooOrFade(tr: Transition, eased: number): void {
    if (tr.mode === "goo" && goo.enabled) {
      const fontSize = readFontSize();
      applyGooState(stage.outgoing, tr.outStart * (1 - eased), fontSize, goo.blur);
      applyGooState(stage.incoming, eased, fontSize, goo.blur);
    } else {
      applyFadeState(stage.outgoing, tr.outStart * (1 - eased));
      applyFadeState(stage.incoming, eased);
    }
  }

  function renderRise(tr: Transition): void {
    const scene = tr.scene;
    const timing = tr.timing;
    if (!scene || !timing) return;

    const duration = tr.duration;
    const elapsed = Math.max(0, Math.min(duration, tr.elapsed));
    const global = duration > 0 ? clamp01(elapsed / duration) : 1;
    const globalEased = ease(global);
    const fontSize = readFontSize();

    for (let order = 0; order < tr.enter.length; order += 1) {
      const record = tr.enter[order]!;
      const local = easeRise(enterProgress(elapsed, order, timing));
      const gooOpacity = goo.enabled ? opacityForFraction(local) : local;
      const gooBlur = goo.enabled ? blurForFraction(local, fontSize, goo.blur) : 0;
      const motion = enterTransform(
        local,
        rise.travel,
        rise.scale,
        rise.blur,
        tr.flowByChunk?.get(record.chunk.id) ?? tr.flow,
      );
      record.span.style.opacity = String(gooOpacity);
      record.span.style.filter = combineBlur(gooBlur, motion.blurEm * fontSize);
      record.span.style.transform = `translate(${(motion.xEm * fontSize).toFixed(2)}px, ${(motion.yEm * fontSize).toFixed(2)}px) scale(${motion.scale.toFixed(4)})`;
    }

    for (let order = 0; order < tr.exit.length; order += 1) {
      const record = tr.exit[order]!;
      const local = easeRise(exitProgress(elapsed, order, timing));
      const remaining = 1 - local;
      const gooOpacity = goo.enabled ? opacityForFraction(remaining) : remaining;
      const gooBlur = goo.enabled ? blurForFraction(remaining, fontSize, goo.blur) : 0;
      const motion = exitTransform(
        local,
        rise.travel,
        rise.scale,
        rise.blur,
        tr.flowByChunk?.get(record.chunk.id) ?? tr.flow,
      );
      record.span.style.opacity = String(gooOpacity);
      record.span.style.filter = combineBlur(gooBlur, motion.blurEm * fontSize);
      record.span.style.transform = `translate(${(motion.xEm * fontSize).toFixed(2)}px, ${(motion.yEm * fontSize).toFixed(2)}px) scale(${motion.scale.toFixed(4)})`;
    }

    for (const record of scene.matched) {
      record.span.style.opacity = "1";
      record.span.style.filter = "none";
      record.span.style.transform = `translate(${(record.dx * (1 - globalEased)).toFixed(2)}px, ${(record.dy * (1 - globalEased)).toFixed(2)}px)`;
    }
  }

  function renderTransition(tr: Transition, raw: number): void {
    tr.raw = clamp01(raw);
    const eased = ease(tr.raw);
    tr.eased = eased;
    if (tr.mode === "rise") {
      renderRise(tr);
    } else {
      renderGooOrFade(tr, eased);
    }
  }

  function clearPending(): void {
    if (!pending) return;
    const queued = pending;
    pending = null;
    queued.resolve();
  }

  function completeTransition(tr: Transition): void {
    if (transition !== tr) return;
    transition = null;
    tr.elapsed = tr.duration;
    tr.raw = 1;
    tr.eased = 1;
    renderTransition(tr, 1);
    currentText = tr.to;
    const completedIndex = words.indexOf(tr.to);
    if (completedIndex >= 0) wordIndex = completedIndex;
    renderSettled(currentText);
    setLiveText(stage.live, currentText);
    tr.resolve();
    syncFilter();
    safeCallback(onMorphEnd, tr.from, tr.to);

    const queued = pending;
    pending = null;
    if (queued && !destroyed) {
      void startMorph(queued.text).then(queued.resolve, queued.resolve);
      return;
    }

    if (!destroyed) {
      if (auto && !paused) {
        if (canAutoAdvance()) {
          autoRest = restTime;
        } else {
          auto = false;
          autoRest = null;
        }
      }
      syncLoop();
    }
  }

  function snapTo(text: string): Promise<void> {
    clearPending();
    if (transition) {
      const tr = transition;
      transition = null;
      tr.resolve();
    }
    currentText = text;
    const settledIndex = words.indexOf(text);
    if (settledIndex >= 0) wordIndex = settledIndex;
    renderSettled(text);
    setLiveText(stage.live, text);
    autoRest = null;
    if (auto && !paused && words.length > 1) {
      if (canAutoAdvance()) autoRest = restTime;
      else auto = false;
    }
    syncFilter();
    syncLoop();
    return Promise.resolve();
  }

  function queueMorph(to: string): Promise<void> {
    if (pending?.text === to) return pending.promise;
    if (pending) pending.resolve();
    let resolve = (): void => undefined;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    pending = { text: to, promise, resolve };
    if (transition) transition.fastForward = true;
    syncLoop();
    return promise;
  }

  function startMorph(to: string): Promise<void> {
    if (destroyed) return Promise.resolve();
    if (paused) return snapTo(to);
    if (transition && transition.to === to) return transition.promise;
    if (!transition && to === currentText) return Promise.resolve();

    let fromText: string;
    let outStart = 1;
    const previous = transition;

    if (previous) {
      if (previous.mode === "rise") return queueMorph(to);

      const progress = previous.eased;
      const outValue = previous.outStart * (1 - progress);
      const outOpacity = previous.mode === "goo" ? opacityForFraction(outValue) : outValue;
      const inOpacity = previous.mode === "goo" ? opacityForFraction(progress) : progress;
      const dominantOpacity = Math.max(outOpacity, inOpacity);

      if (inOpacity > outOpacity) fromText = previous.to;
      else fromText = previous.from;

      transition = null;
      previous.resolve();

      const reduced = prefersReducedMotion(doc);
      const nextMode: TransitionMode = reduced
        ? "fade"
        : rise.enabled
          ? "rise"
          : goo.enabled
            ? "goo"
            : "fade";
      outStart =
        nextMode === "goo" ? Math.pow(clamp01(dominantOpacity), 1 / 0.4) : clamp01(dominantOpacity);
    } else {
      fromText = currentText;
    }

    const reduced = prefersReducedMotion(doc);
    const mode: TransitionMode = reduced
      ? "fade"
      : rise.enabled
        ? "rise"
        : goo.enabled
          ? "goo"
          : "fade";

    const duration =
      mode === "fade"
        ? morphTime <= 0
          ? 0
          : Math.min(reduced ? REDUCED_MOTION_FADE : NO_EFFECT_FADE, morphTime)
        : morphTime;

    let resolve = (): void => undefined;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });

    const tr: Transition = {
      from: fromText,
      to,
      mode,
      duration,
      elapsed: 0,
      raw: 0,
      eased: 0,
      outStart,
      enter: [],
      exit: [],
      flow: "up",
      fastForward: false,
      promise,
      resolve,
    };

    transition = tr;
    autoRest = null;

    if (mode === "rise") {
      const direction = readDirection();
      const scene = buildDiffScene(stage, fromText, to, {
        rtl: direction.rtl,
        dir: direction.dir,
        minChunk: rise.minChunk,
        normalizeVariants: rise.normalizeVariants,
        ignoreDiacritics: rise.ignoreDiacritics,
      });
      tr.scene = scene;
      tr.enter = enterOrder(scene, direction.rtl);
      tr.exit = exitOrder(scene, direction.rtl);
      const flowState = flowForTransition(
        rise.flow,
        scene,
        fromText,
        to,
        direction.dir,
        direction.rtl,
      );
      tr.flow = flowState.fallback;
      tr.flowByChunk = flowState.byChunk;
      tr.timing = riseTiming(
        duration,
        Math.max(tr.enter.length, tr.exit.length),
        rise.stagger,
        rise.overlap,
      );
      renderRise(tr);
    } else {
      resetLayer(stage.outgoing);
      resetLayer(stage.incoming);
      setLayerText(stage.outgoing, fromText);
      setLayerText(stage.incoming, to);
      renderGooOrFade(tr, 0);
    }

    setLiveText(stage.live, to);
    syncFilter();
    safeCallback(onMorphStart, fromText, to);

    if (destroyed) {
      if (transition === tr) transition = null;
      return promise;
    }

    if (duration <= 0) {
      completeTransition(tr);
      return promise;
    }

    syncLoop();
    return promise;
  }

  function tick(timestamp: number): void {
    rafId = null;
    if (!needsLoop()) {
      lastTimestamp = null;
      return;
    }

    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
      rafId = requestFrame();
      return;
    }

    const dt = Math.min(Math.max((timestamp - lastTimestamp) / 1000, 0), MAX_FRAME_DELTA);
    lastTimestamp = timestamp;

    if (transition) {
      const tr = transition;
      let step = dt;
      if (tr.fastForward && tr.duration > 0) {
        const remaining = Math.max(0, tr.duration - tr.elapsed);
        step *= Math.max(1, remaining / FAST_FORWARD);
      }
      tr.elapsed = Math.min(tr.duration, tr.elapsed + step);
      const raw = tr.duration > 0 ? clamp01(tr.elapsed / tr.duration) : 1;
      renderTransition(tr, raw);
      if (raw >= 1) completeTransition(tr);
    } else if (auto && !paused) {
      if (autoRest === null) {
        if (canAutoAdvance()) autoRest = restTime;
        else auto = false;
      }
      if (autoRest !== null) {
        autoRest -= dt;
        if (autoRest <= 0) {
          if (!canAutoAdvance()) {
            auto = false;
            autoRest = null;
          } else {
            wordIndex = wrapIndex(wordIndex + 1, words.length, loop);
            const nextWord = words[wordIndex];
            if (nextWord !== undefined) {
              autoRest = null;
              void startMorph(nextWord);
            }
          }
        }
      }
    }

    if (rafId === null && needsLoop()) {
      rafId = requestFrame();
    } else if (!needsLoop()) {
      lastTimestamp = null;
    }
  }

  function onVisibilityChange(): void {
    hidden = doc.visibilityState === "hidden";
    syncLoop();
  }

  doc.addEventListener("visibilitychange", onVisibilityChange);

  let observer: IntersectionObserver | null = null;
  const view = doc.defaultView;
  if (view && typeof view.IntersectionObserver === "function") {
    observer = new view.IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        offscreen = !entry.isIntersecting;
        syncLoop();
      },
      { rootMargin: "80px" },
    );
    observer.observe(el);
  }

  function setText(text: string): Promise<void> {
    if (destroyed) return Promise.resolve();
    const value = String(text);
    if (paused) return snapTo(value);
    return startMorph(value);
  }

  function next(): Promise<void> {
    if (destroyed || words.length === 0) return Promise.resolve();
    if (!canAdvance(wordIndex, words.length, loop)) {
      return Promise.resolve();
    }
    wordIndex = wrapIndex(wordIndex + 1, words.length, loop);
    const target = words[wordIndex];
    if (target === undefined) return Promise.resolve();
    return startMorph(target);
  }

  function setWords(nextWords: string[]): void {
    if (destroyed) return;
    words = Array.isArray(nextWords) ? nextWords.map((word) => String(word)) : [];

    if (words.length === 0) {
      wordIndex = 0;
      autoRest = null;
      syncLoop();
      return;
    }

    const reference = pending?.text ?? transition?.to ?? currentText;
    const found = words.indexOf(reference);
    wordIndex = found >= 0 ? found : 0;
    autoRest = null;
    if (autoplay && !paused && words.length > 1 && canAutoAdvance()) {
      auto = true;
      autoRest = restTime;
    }
    syncLoop();
  }

  function play(): void {
    if (destroyed) return;
    paused = false;
    if (!transition && pending) {
      const queued = pending;
      pending = null;
      void startMorph(queued.text).then(queued.resolve, queued.resolve);
    }
    if (words.length > 1 && canAutoAdvance()) {
      auto = true;
      if (!transition && autoRest === null) autoRest = restTime;
    }
    syncLoop();
  }

  function pause(): void {
    if (destroyed) return;
    paused = true;
    stopLoop();
  }

  function applyUpdate(partial: Partial<MorphOptions>): void {
    if (destroyed) return;

    if (partial.words !== undefined) {
      const nextWords = Array.isArray(partial.words)
        ? partial.words.map((word) => String(word))
        : [];
      if (!sameWords(nextWords, words)) setWords(nextWords);
    }

    if (partial.morphTime !== undefined) {
      morphTime = nonNegative(partial.morphTime, morphTime);
    }
    if (partial.restTime !== undefined) {
      restTime = nonNegative(partial.restTime, restTime);
    }

    let effectsChanged = false;
    if (partial.effects !== undefined) {
      if (partial.effects.goo !== undefined) {
        const nextGoo = applyGooPatch(goo, partial.effects.goo);
        effectsChanged =
          effectsChanged ||
          nextGoo.enabled !== goo.enabled ||
          nextGoo.threshold !== goo.threshold ||
          nextGoo.blur !== goo.blur ||
          nextGoo.atRest !== goo.atRest;
        goo = nextGoo;
      }
      if (partial.effects.rise !== undefined) {
        const nextRise = applyRisePatch(rise, partial.effects.rise);
        effectsChanged = effectsChanged || nextRise.enabled !== rise.enabled;
        rise = nextRise;
      }
      refreshFilter();
    }

    if (partial.dir !== undefined) {
      dir = partial.dir;
      el.setAttribute("dir", partial.dir);
    }
    if (partial.lang !== undefined) {
      lang = partial.lang;
      el.setAttribute("lang", partial.lang);
    }
    if (partial.easing !== undefined) {
      easing = typeof partial.easing === "function" ? partial.easing : DEFAULT_MORPH_EASING;
    }
    if (partial.onMorphStart !== undefined) {
      onMorphStart = partial.onMorphStart;
    }
    if (partial.onMorphEnd !== undefined) {
      onMorphEnd = partial.onMorphEnd;
    }
    if (partial.loop !== undefined && partial.loop !== loop) {
      loop = partial.loop;
      if (autoplay && !paused && !transition && words.length > 1 && canAutoAdvance()) {
        auto = true;
        autoRest = restTime;
      } else if (auto && words.length > 1 && canAutoAdvance() && autoRest === null) {
        autoRest = restTime;
      }
    }
    if (partial.autoplay !== undefined && partial.autoplay !== autoplay) {
      autoplay = partial.autoplay;
      auto = partial.autoplay;
      autoRest = null;
      if (auto && !paused && words.length > 1 && canAutoAdvance()) {
        autoRest = restTime;
      }
    }

    if (effectsChanged && !transition) {
      renderSettled(currentText);
    }
    syncFilter();
    syncLoop();
  }

  function update(partial: Partial<MorphOptions>): void {
    if (destroyed) return;

    if (partial.preset !== undefined || partial.motion !== undefined) {
      const nextPreset = partial.preset ?? currentPreset;
      const nextMotion =
        partial.motion ?? (partial.preset !== undefined ? "default" : currentMotion);
      const resolved = resolveMorphOptions({
        ...partial,
        preset: nextPreset,
        motion: nextMotion,
      });
      currentPreset = nextPreset;
      currentMotion = nextMotion;
      applyUpdate(resolved);
      return;
    }

    applyUpdate(partial);
  }

  function restoreStyle(name: keyof SavedStyle, value: string): void {
    if (value) {
      el.style[name] = value;
    } else {
      el.style.removeProperty(
        name === "minHeight" ? "min-height" : name === "filter" ? "filter" : name,
      );
    }
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    paused = true;
    stopLoop();
    doc.removeEventListener("visibilitychange", onVisibilityChange);
    observer?.disconnect();
    observer = null;

    clearPending();
    if (transition) {
      const tr = transition;
      transition = null;
      tr.resolve();
    }

    filter?.release();
    filter = null;

    removeStage(stage);
    if (originalNodes.length > 0) el.append(...originalNodes);

    restoreStyle("position", savedStyle.position);
    restoreStyle("display", savedStyle.display);
    restoreStyle("minHeight", savedStyle.minHeight);
    restoreStyle("width", savedStyle.width);
    restoreStyle("filter", savedStyle.filter);

    if (originalDir === null) el.removeAttribute("dir");
    else el.setAttribute("dir", originalDir);
    if (originalLang === null) el.removeAttribute("lang");
    else el.setAttribute("lang", originalLang);
  }

  renderSettled(currentText);
  setLiveText(stage.live, currentText);
  syncFilter();
  syncLoop();

  return {
    setText,
    next,
    setWords,
    play,
    pause,
    destroy,
    update,
  };
}
