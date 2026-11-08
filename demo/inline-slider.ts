import "./inline-slider.css";

const TICK_COUNT = 10;
const TRACK_START = 8;
const TRACK_END_INSET = 12;
const FILL_LEAD = 8;

export interface InlineSlider {
  render: () => void;
  destroy: () => void;
}

/**
 * Turns an existing label + native range input into an inline slider.
 *
 * The native input stays in place as the interaction layer, so keyboard
 * handling, step values, touch and screen-reader semantics keep working.
 * Everything else (fill, ticks, thumb, label and readout) is visual.
 */
export function enhanceInlineSlider(
  root: HTMLLabelElement,
  input: HTMLInputElement,
  labelEl: HTMLElement,
  valueEl: HTMLElement,
): InlineSlider {
  root.classList.add("inline-slider");
  labelEl.classList.add("inline-slider__label");
  valueEl.classList.add("inline-slider__value");
  input.classList.add("inline-slider__input");
  labelEl.setAttribute("aria-hidden", "true");
  valueEl.setAttribute("aria-hidden", "true");

  const ticks = document.createElement("span");
  ticks.className = "inline-slider__ticks";
  ticks.setAttribute("aria-hidden", "true");
  const dots = Array.from({ length: TICK_COUNT }, () => {
    const dot = document.createElement("i");
    ticks.append(dot);
    return dot;
  });

  const fillClip = document.createElement("span");
  fillClip.className = "inline-slider__fill-clip";
  fillClip.setAttribute("aria-hidden", "true");
  const fill = document.createElement("span");
  fill.className = "inline-slider__fill";
  fillClip.append(fill);

  const thumb = document.createElement("span");
  thumb.className = "inline-slider__thumb";
  thumb.setAttribute("aria-hidden", "true");
  const thumbInner = document.createElement("span");
  thumbInner.className = "inline-slider__thumb-inner";
  const topDot = document.createElement("span");
  topDot.className = "inline-slider__dot inline-slider__dot--top";
  const bar = document.createElement("span");
  bar.className = "inline-slider__bar";
  const bottomDot = document.createElement("span");
  bottomDot.className = "inline-slider__dot inline-slider__dot--bottom";
  thumbInner.append(topDot, bar, bottomDot);
  thumb.append(thumbInner);

  root.append(fillClip, ticks, thumb);

  if (!input.hasAttribute("aria-label")) {
    const name = labelEl.textContent?.trim();
    if (name) input.setAttribute("aria-label", name);
  }

  let width = 0;
  let labelStart = 0;
  let labelEnd = 0;
  let valueStart = 0;
  let valueEnd = 0;
  let frame = 0;
  let ready = false;

  function measure(): void {
    if (!root.isConnected) return;

    const rootRect = root.getBoundingClientRect();
    width = rootRect.width;
    const labelRect = labelEl.getBoundingClientRect();
    const valueRect = valueEl.getBoundingClientRect();

    labelStart = labelRect.left - rootRect.left;
    labelEnd = labelRect.right - rootRect.left;
    valueStart = valueRect.left - rootRect.left;
    valueEnd = valueRect.right - rootRect.left;
  }

  function tickX(index: number): number {
    const end = Math.max(TRACK_START, width - TRACK_END_INSET);
    return TRACK_START + ((end - TRACK_START) * index) / (TICK_COUNT - 1);
  }

  function overlapAt(x: number, start: number, end: number): number {
    return Math.max(0, Math.min(1, (x + 4 - start) / 6, (end - x) / 6));
  }

  function collides(x: number, start: number, end: number): boolean {
    return x + 2 >= start && x - 2 <= end;
  }

  function render(): void {
    if (!root.isConnected) return;

    measure();
    if (width <= 0) return;

    const min = Number(input.min) || 0;
    const max = Number(input.max) || 0;
    const value = Number(input.value);
    const ratio = max > min ? (value - min) / (max - min) : 0;
    const progress = Math.max(0, Math.min(1, ratio));

    const x = TRACK_START + progress * (width - TRACK_START - TRACK_END_INSET);
    thumb.style.transform = `translateX(${x}px)`;

    const fillRight = progress >= 1 ? width - 2 : Math.min(width - 2, x + FILL_LEAD);
    fill.style.transform = `translateX(${fillRight - (width - 2)}px)`;

    const part = Math.max(overlapAt(x, labelStart, labelEnd), overlapAt(x, valueStart, valueEnd));
    bar.style.opacity = String(1 - part);
    topDot.style.transform = `translateY(${-part}px)`;
    bottomDot.style.transform = `translateY(${part}px)`;

    for (let index = 0; index < dots.length; index += 1) {
      const dot = dots[index];
      if (!dot) continue;
      const xAtTick = tickX(index);
      dot.style.left = `${xAtTick}px`;
      dot.style.visibility =
        collides(xAtTick, labelStart, labelEnd) || collides(xAtTick, valueStart, valueEnd)
          ? "hidden"
          : "visible";
    }

    const text = valueEl.textContent?.trim();
    if (text) input.setAttribute("aria-valuetext", text);
    else input.removeAttribute("aria-valuetext");

    if (!ready) {
      ready = true;
      requestAnimationFrame(() => root.classList.add("is-ready"));
    }
  }

  function schedule(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      render();
    });
  }

  const observer = new ResizeObserver(schedule);
  observer.observe(root);
  observer.observe(labelEl);
  observer.observe(valueEl);

  const startDrag = (): void => root.classList.add("is-dragging");
  const endDrag = (): void => root.classList.remove("is-dragging");

  input.addEventListener("input", render);
  input.addEventListener("change", render);
  input.addEventListener("pointerdown", startDrag);
  input.addEventListener("pointerup", endDrag);
  input.addEventListener("pointercancel", endDrag);
  input.addEventListener("blur", endDrag);

  schedule();

  return {
    render,
    destroy() {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      input.removeEventListener("input", render);
      input.removeEventListener("change", render);
      input.removeEventListener("pointerdown", startDrag);
      input.removeEventListener("pointerup", endDrag);
      input.removeEventListener("pointercancel", endDrag);
      input.removeEventListener("blur", endDrag);
    },
  };
}
