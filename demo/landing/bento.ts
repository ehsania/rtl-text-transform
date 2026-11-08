import { PLAYGROUND_PATH } from "./config";
import { EXAMPLES } from "./examples/registry";
import type { ExampleDefinition } from "./examples/types";
import { h } from "./ui";

function buildCard(example: ExampleDefinition): HTMLElement {
  const instance = example.create({ controls: false });

  const card = h("section", `bento-card${example.wide ? " bento-card--wide" : ""}`);
  card.id = `bento-${example.id}`;
  card.setAttribute("aria-label", example.label);

  instance.stage.classList.add("bento-stage");

  const footer = h("div", "bento-card-foot");
  const link = h("a", "card-playground", "Playground");
  link.href = `${PLAYGROUND_PATH}?example=${example.id}`;
  link.setAttribute("aria-label", `Open the ${example.label} example in the playground`);
  footer.append(link);

  card.append(instance.stage, footer);
  return card;
}

export function mountBento(): HTMLElement {
  const grid = h("div", "bento");
  grid.setAttribute("aria-label", "Live examples");
  grid.append(...EXAMPLES.map(buildCard));

  // The button card measures its label. It was built detached, so re-run the
  // measurement after the grid is in the document.
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });

  return grid;
}
