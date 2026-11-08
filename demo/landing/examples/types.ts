import type { BaseState, Language, Speed } from "../code";

export type ExampleId = "words" | "counter" | "button" | "tabs" | "toast";

export interface ExampleOptions {
  /** Build the playground-only control panels. */
  controls: boolean;
}

export interface ExampleInstance {
  readonly id: ExampleId;
  readonly stage: HTMLElement;
  /** Example-specific controls. Null when the stage itself is the control. */
  readonly specific: HTMLElement | null;
  /** Fallback hint shown when `specific` is null. */
  readonly specificHint: string | null;
  /** Shared morph controls. */
  readonly shared: HTMLElement | null;
  readonly state: BaseState;

  setLanguage: (lang: Language) => void;
  setSpeed: (speed: Speed) => void;
  replay: () => void;
  reset: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
}

export interface ExampleDefinition {
  id: ExampleId;
  label: string;
  title: string;
  description: string;
  wide?: boolean;
  create: (options: ExampleOptions) => ExampleInstance;
}
