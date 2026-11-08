import { createElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ElementType, HTMLAttributes, RefObject } from "react";
import { createMorph } from "./index";
import type { Morph, MorphOptions } from "./index";

export * from "./index";

export interface UseMorphResult<T extends HTMLElement = HTMLElement> {
  /** Attach this ref to the container element. */
  ref: RefObject<T | null>;
  /** The live instance, or null before the first effect runs. */
  morph: Morph | null;
  setText: (text: string) => Promise<void>;
  next: () => Promise<void>;
  setWords: (words: string[]) => void;
  play: () => void;
  pause: () => void;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Create a morph tied to a ref. Options are forwarded to `createMorph`;
 * updates are applied without re-creating the instance.
 */
export function useMorph<T extends HTMLElement = HTMLElement>(
  options: MorphOptions = {},
): UseMorphResult<T> {
  const ref = useRef<T | null>(null);
  const [morph, setMorph] = useState<Morph | null>(null);
  const [initialOptions] = useState(() => options);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const instance = createMorph(node, initialOptions);
    setMorph(instance);
    return () => {
      instance.destroy();
    };
  }, [initialOptions]);

  useEffect(() => {
    morph?.update(options);
  }, [morph, options]);

  const setText = useCallback((text: string) => morph?.setText(text) ?? Promise.resolve(), [morph]);
  const next = useCallback(() => morph?.next() ?? Promise.resolve(), [morph]);
  const setWords = useCallback((words: string[]) => morph?.setWords(words), [morph]);
  const play = useCallback(() => morph?.play(), [morph]);
  const pause = useCallback(() => morph?.pause(), [morph]);

  return { ref, morph, setText, next, setWords, play, pause };
}

export interface MorphTextProps
  extends MorphOptions, Omit<HTMLAttributes<HTMLElement>, "children" | "dir" | "lang"> {
  /** Controlled text. If omitted, `words` is used. */
  text?: string;
  /** Element type for the container. Defaults to div. */
  as?: ElementType;
}

/**
 * Thin component wrapper. The element is managed by the vanilla core, so do not
 * pass children: use `text` or `words`.
 */
export function MorphText({
  text,
  as: Tag = "div",
  words,
  morphTime,
  restTime,
  effects,
  preset,
  motion,
  dir,
  lang,
  autoplay,
  loop,
  easing,
  onMorphStart,
  onMorphEnd,
  ...elementProps
}: MorphTextProps) {
  const { ref, morph } = useMorph<HTMLElement>({
    words,
    morphTime,
    restTime,
    effects,
    preset,
    motion,
    dir,
    lang,
    autoplay,
    loop,
    easing,
    onMorphStart,
    onMorphEnd,
  });

  const initialised = useRef(false);
  useIsomorphicLayoutEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    if (ref.current && text !== undefined) {
      ref.current.textContent = text;
    }
  }, [ref, text]);

  const previousText = useRef(text);
  useEffect(() => {
    if (!morph || text === undefined || text === previousText.current) {
      return;
    }
    previousText.current = text;
    void morph.setText(text);
  }, [morph, text]);

  // The ref is forwarded to the container; React reads it, the component does not.
  // eslint-disable-next-line react-hooks/refs
  return createElement(Tag, { ...elementProps, ref });
}

MorphText.displayName = "MorphText";
