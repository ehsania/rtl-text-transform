import { createTabsExample } from "./app-bar";
import { createButtonExample } from "./button";
import { createCounterExample } from "./counter";
import { createToastExample } from "./toast";
import { createWordsExample } from "./words";
import type { ExampleDefinition, ExampleId } from "./types";

export const EXAMPLES: ExampleDefinition[] = [
  {
    id: "words",
    label: "Words",
    title: "Words",
    description:
      "Cycle through Persian or Arabic words while shared letters stay put and only the changed hunks rise.",
    wide: true,
    create: createWordsExample,
  },
  {
    id: "counter",
    label: "Counter",
    title: "Counter and numerals",
    description:
      "Persian digits come from Intl.NumberFormat. Only the numeral changes; the shared phrase stays in place.",
    create: createCounterExample,
  },
  {
    id: "button",
    label: "Button",
    title: "Button with loading indicator",
    description:
      "Click the button. The loading label contains the idle word, so Rise keeps that word in place while new words arrive.",
    create: createButtonExample,
  },
  {
    id: "tabs",
    label: "Tabs",
    title: "App bar title",
    description:
      "A small mobile app bar morphs its title when you switch tabs. Only the changed letters travel.",
    create: createTabsExample,
  },
  {
    id: "toast",
    label: "Toast",
    title: "Toast",
    description:
      "A notification area swaps between three messages. Next advances immediately; autoplay uses rest time.",
    create: createToastExample,
  },
];

export const EXAMPLE_BY_ID: ReadonlyMap<ExampleId, ExampleDefinition> = new Map(
  EXAMPLES.map((example) => [example.id, example]),
);

export function isExampleId(value: string | null | undefined): value is ExampleId {
  return value !== null && value !== undefined && EXAMPLE_BY_ID.has(value as ExampleId);
}
