import { afterEach, describe, expect, it, vi } from "vitest";
import { createMorph } from "../src/index";
import { easeInOutCubic, easeOutCubic } from "../src/core/easing";
import { getFilterRefCount } from "../src/core/filter";
import { opacityForFraction } from "../src/core/math";
import { chunks, createHost, installFrameClock, layers } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("createMorph stage", () => {
  it("builds two hidden layers, a live copy and a sized host", () => {
    const host = createHost("سلام");
    host.setAttribute("dir", "ltr");
    host.setAttribute("lang", "en");

    const morph = createMorph(host, {
      dir: "rtl",
      lang: "fa",
      autoplay: false,
    });

    const { outgoing, live, outgoingShell, incomingShell } = layers(host);
    expect(live.textContent).toBe("سلام");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(outgoingShell.getAttribute("aria-hidden")).toBe("true");
    expect(incomingShell.getAttribute("aria-hidden")).toBe("true");
    expect(outgoing.style.getPropertyValue("letter-spacing")).toBe("0");
    expect(outgoing.style.getPropertyPriority("letter-spacing")).toBe("important");
    expect(outgoingShell.style.fontFamily).toBe("inherit");
    expect(outgoingShell.style.fontSize).toBe("inherit");
    expect(outgoingShell.style.fontWeight).toBe("inherit");
    expect(host.getAttribute("dir")).toBe("rtl");
    expect(host.getAttribute("lang")).toBe("fa");
    expect(host.style.position).toBe("relative");
    expect(host.style.minHeight).toBe("1.6em");
    expect(host.style.filter).toMatch(/^url\(#goo-morph-\d+\) blur\(0\.6px\)$/);
    expect(getFilterRefCount(140)).toBe(1);

    morph.destroy();

    expect(host.querySelector("[data-morph-layer]")).toBeNull();
    expect(host.querySelector("[data-morph-live]")).toBeNull();
    expect(host.textContent).toBe("سلام");
    expect(host.getAttribute("dir")).toBe("ltr");
    expect(host.getAttribute("lang")).toBe("en");
    expect(host.style.filter).toBe("");
    expect(getFilterRefCount(140)).toBe(0);
  });

  it("uses defaults of goo on and rise off", () => {
    const host = createHost("سلام");
    const morph = createMorph(host, { autoplay: false });
    expect(host.style.filter).toContain("blur(0.6px)");
    expect(layers(host).outgoing.querySelectorAll("[data-chunk-id]")).toHaveLength(0);
    morph.destroy();
  });

  it("composes the host filter from the enabled effects", () => {
    const host = createHost("سلام");
    const morph = createMorph(host, { autoplay: false });

    morph.update({ effects: { rise: true } });
    expect(host.style.filter).toMatch(/^url\(#goo-morph-\d+\)$/);
    expect(host.style.filter).not.toContain("blur(0.6px)");

    morph.update({ effects: { goo: false } });
    expect(host.style.filter).toBe("none");

    morph.update({ effects: { goo: true, rise: false } });
    expect(host.style.filter).toContain("blur(0.6px)");

    morph.update({ effects: { goo: { threshold: 180 } } });
    expect(getFilterRefCount(140)).toBe(0);
    expect(getFilterRefCount(180)).toBe(1);

    morph.destroy();
    expect(getFilterRefCount(180)).toBe(0);
  });
});

describe("goo morph", () => {
  it("starts an interrupted morph from the current visual state", async () => {
    const clock = installFrameClock();
    const host = createHost("A");
    const morph = createMorph(host, {
      morphTime: 1,
      effects: { goo: { atRest: false } },
      autoplay: false,
    });
    const { outgoing, incoming, live } = layers(host);

    expect(host.style.filter).toBe("none");

    const first = morph.setText("B");
    clock.step(0);
    clock.frames(5, 100);

    expect(first).toBeInstanceOf(Promise);
    expect(host.style.filter).toMatch(/^url\(#goo-morph-\d+\) blur\(0\.6px\)$/);
    expect(Number.parseFloat(outgoing.style.opacity)).toBeCloseTo(Math.pow(0.5, 0.4), 5);
    expect(Number.parseFloat(incoming.style.opacity)).toBeCloseTo(Math.pow(0.5, 0.4), 5);

    const outgoingBefore = Number.parseFloat(outgoing.style.opacity);
    const second = morph.setText("C");

    // The dominant layer keeps its exact opacity; the new target starts hidden.
    expect(Number.parseFloat(outgoing.style.opacity)).toBeCloseTo(outgoingBefore, 10);
    expect(outgoing.textContent).toBe("A");
    expect(incoming.textContent).toBe("C");
    expect(Number.parseFloat(incoming.style.opacity)).toBe(0);
    expect(live.textContent).toBe("C");

    await first;
    clock.frames(11, 100);
    await second;

    expect(incoming.style.opacity).toBe("1");
    expect(outgoing.style.opacity).toBe("0");
    expect(incoming.textContent).toBe("C");
    expect(host.style.filter).toBe("none");
    expect(clock.pending()).toBe(0);

    morph.destroy();
  });

  it("eases the overall morph with ease-in-out by default", () => {
    const clock = installFrameClock();
    const host = createHost("A");
    const morph = createMorph(host, {
      morphTime: 1,
      effects: { goo: { atRest: false } },
      autoplay: false,
    });
    const { incoming } = layers(host);

    void morph.setText("B");
    clock.step(0);
    clock.frames(2, 100);

    // Raw progress is 0.2; ease-in-out cubic maps it to 0.032.
    expect(Number.parseFloat(incoming.style.opacity)).toBeCloseTo(
      opacityForFraction(easeInOutCubic(0.2)),
      5,
    );
    expect(Number.parseFloat(incoming.style.opacity)).toBeLessThan(opacityForFraction(0.2));

    morph.destroy();
  });

  it("lets a custom easing override the default curve", () => {
    const clock = installFrameClock();
    const host = createHost("A");
    const morph = createMorph(host, {
      morphTime: 1,
      easing: (t) => t,
      effects: { goo: { atRest: false } },
      autoplay: false,
    });
    const { incoming } = layers(host);

    void morph.setText("B");
    clock.step(0);
    clock.frames(2, 100);

    expect(Number.parseFloat(incoming.style.opacity)).toBeCloseTo(opacityForFraction(0.2), 5);

    morph.destroy();
  });

  it("freezes on pause and resumes on play", () => {
    const clock = installFrameClock();
    const host = createHost();
    const morph = createMorph(host, {
      words: ["a", "b"],
      autoplay: true,
      restTime: 0,
      morphTime: 1,
      effects: { goo: { atRest: false } },
    });
    const { incoming } = layers(host);

    clock.step(0);
    clock.step(100); // starts a -> b
    clock.frames(4, 100); // progress is now 0.4
    const beforePause = Number.parseFloat(incoming.style.opacity);
    expect(beforePause).toBeGreaterThan(0);

    morph.pause();
    expect(clock.pending()).toBe(0);
    clock.step(500);
    expect(Number.parseFloat(incoming.style.opacity)).toBeCloseTo(beforePause, 10);

    morph.play();
    expect(clock.pending()).toBe(1);
    clock.step(0);
    clock.step(100);
    expect(Number.parseFloat(incoming.style.opacity)).toBeGreaterThan(beforePause);

    morph.destroy();
  });

  it("wraps around the word list and stops when loop is false", async () => {
    const clock = installFrameClock();
    const host = createHost();
    const morph = createMorph(host, {
      words: ["a", "b", "c"],
      autoplay: false,
      morphTime: 0.1,
      loop: true,
    });
    const { live } = layers(host);

    async function nextAndFinish(): Promise<void> {
      const promise = morph.next();
      clock.step(0);
      clock.step(100);
      await promise;
    }

    await nextAndFinish();
    expect(live.textContent).toBe("b");
    await nextAndFinish();
    expect(live.textContent).toBe("c");
    await nextAndFinish();
    expect(live.textContent).toBe("a");

    morph.update({ loop: false });
    await nextAndFinish();
    expect(live.textContent).toBe("b");
    await nextAndFinish();
    expect(live.textContent).toBe("c");

    const stopped = morph.next();
    clock.step(100);
    await stopped;
    expect(live.textContent).toBe("c");
    expect(clock.pending()).toBe(0);

    morph.destroy();
  });

  it("auto-cycles and wraps around the word list", () => {
    const clock = installFrameClock();
    const host = createHost();
    const morph = createMorph(host, {
      words: ["a", "b"],
      autoplay: true,
      restTime: 0.3,
      morphTime: 0.1,
      loop: true,
    });
    const { live } = layers(host);

    expect(live.textContent).toBe("a");
    clock.step(0);
    clock.frames(4, 100); // rest, morph to b and finish it
    expect(live.textContent).toBe("b");
    clock.frames(5, 100); // rest, wrap to a and finish it
    expect(live.textContent).toBe("a");
    expect(clock.pending()).toBe(1);

    morph.destroy();
  });

  it("resumes autoplay when setWords grows a one-word list", () => {
    const clock = installFrameClock();
    const host = createHost();
    const morph = createMorph(host, {
      words: ["a"],
      autoplay: true,
      restTime: 0.3,
      morphTime: 0.1,
      loop: true,
    });
    const { live } = layers(host);

    void morph.setText("b");
    clock.step(0);
    clock.frames(2, 100);
    expect(live.textContent).toBe("b");

    morph.setWords(["b", "c"]);
    clock.step(0);
    clock.frames(4, 100);
    expect(live.textContent).toBe("c");

    morph.destroy();
  });

  it("applies setText immediately while paused", async () => {
    const host = createHost("A");
    const morph = createMorph(host, { autoplay: false });
    const { live, incoming } = layers(host);

    morph.pause();
    await morph.setText("B");

    expect(live.textContent).toBe("B");
    expect(incoming.textContent).toBe("B");
    expect(incoming.style.opacity).toBe("1");

    morph.destroy();
  });
});

describe("rise morph", () => {
  it("animates only changed hunks and keeps matched text crisp", async () => {
    const clock = installFrameClock();
    const host = createHost("سلام دنیا");
    const morph = createMorph(host, {
      morphTime: 1,
      effects: { goo: false, rise: true },
      autoplay: false,
    });
    const { outgoing, incoming, live } = layers(host);

    const promise = morph.setText("سلام جهان");
    const enter = chunks(incoming, "add");
    const exit = chunks(outgoing, "remove");
    const matched = chunks(incoming, "match");

    expect(enter).toHaveLength(1);
    expect(enter[0]!.textContent).toBe("جهان");
    expect(exit).toHaveLength(1);
    expect(exit[0]!.textContent).toBe("دنیا");
    expect(matched).toHaveLength(1);
    expect(matched[0]!.textContent).toContain("سلام");

    expect(Number.parseFloat(enter[0]!.style.opacity)).toBe(0);
    expect(enter[0]!.style.transform).toContain("translate(");
    // A fully transparent hunk skips its blur entirely.
    expect(enter[0]!.style.filter).toBe("none");
    expect(matched[0]!.style.opacity).toBe("1");
    expect(matched[0]!.style.filter).toBe("none");
    expect(host.style.filter).toBe("none");

    clock.step(0);
    clock.frames(5, 100);

    expect(Number.parseFloat(enter[0]!.style.opacity)).toBeGreaterThan(0);
    expect(Number.parseFloat(enter[0]!.style.opacity)).toBeLessThan(1);
    expect(Number.parseFloat(exit[0]!.style.opacity)).toBeLessThan(1);
    expect(matched[0]!.style.filter).toBe("none");
    expect(matched[0]!.style.opacity).toBe("1");

    clock.frames(6, 100);
    await promise;

    expect(live.textContent).toBe("سلام جهان");
    expect(incoming.textContent).toBe("سلام جهان");
    expect(outgoing.style.opacity).toBe("0");
    expect(incoming.style.opacity).toBe("1");
    expect(clock.pending()).toBe(0);

    morph.destroy();
  });

  it("eases rise hunks with ease-out by default", () => {
    const clock = installFrameClock();
    const host = createHost("سلام دنیا");
    const morph = createMorph(host, {
      morphTime: 1,
      effects: { goo: false, rise: { overlap: 0, stagger: 0 } },
      autoplay: false,
    });
    const { incoming } = layers(host);

    void morph.setText("سلام جهان");
    const enter = chunks(incoming, "add")[0]!;
    clock.step(0);
    clock.frames(2, 100);

    expect(Number.parseFloat(enter.style.opacity)).toBeCloseTo(easeOutCubic(0.2), 5);
    expect(Number.parseFloat(enter.style.opacity)).toBeGreaterThan(0.2);

    morph.destroy();
  });

  it("applies a custom rise easing independently of morph easing", () => {
    const clock = installFrameClock();
    const host = createHost("سلام دنیا");
    const morph = createMorph(host, {
      morphTime: 1,
      easing: (t) => t * t,
      effects: {
        goo: false,
        rise: { overlap: 0, stagger: 0, easing: (t) => t },
      },
      autoplay: false,
    });
    const { incoming } = layers(host);

    void morph.setText("سلام جهان");
    const enter = chunks(incoming, "add")[0]!;
    clock.step(0);
    clock.frames(2, 100);

    expect(Number.parseFloat(enter.style.opacity)).toBeCloseTo(0.2, 5);

    morph.destroy();
  });

  it("fast-forwards an interrupted rise and then runs the latest target", async () => {
    const clock = installFrameClock();
    const host = createHost("A");
    const morph = createMorph(host, {
      morphTime: 1,
      effects: { goo: false, rise: true },
      autoplay: false,
    });
    const { live } = layers(host);

    let firstDone = false;
    const first = morph.setText("B");
    void first.then(() => {
      firstDone = true;
    });
    clock.step(0);
    clock.frames(2, 100);

    const second = morph.setText("C");
    const third = morph.setText("D");
    expect(live.textContent).toBe("B");

    await second;
    clock.step(100);
    clock.step(100);
    expect(firstDone).toBe(false);
    clock.step(100);
    await first;
    expect(firstDone).toBe(true);
    expect(live.textContent).toBe("D");

    clock.frames(12, 100);
    await third;
    expect(live.textContent).toBe("D");
    expect(clock.pending()).toBe(0);

    morph.destroy();
  });

  it("pads chunk edges with ZWJ so joined forms survive the split", () => {
    const host = createHost("کتاب");
    const morph = createMorph(host, {
      effects: { goo: false, rise: true },
      autoplay: false,
    });
    void morph.setText("کتب");
    const { incoming } = layers(host);

    const matched = chunks(incoming, "match");
    const enter = chunks(incoming, "add");
    expect(matched).toHaveLength(1);
    expect(matched[0]!.textContent).toBe("کت\u200D");
    expect(enter).toHaveLength(1);
    expect(enter[0]!.textContent).toBe("\u200Dب");

    morph.destroy();
  });

  it("reverses stagger order for RTL reading order", () => {
    const host = createHost("یک دو");
    host.setAttribute("dir", "rtl");
    const morph = createMorph(host, {
      effects: { goo: false, rise: true },
      autoplay: false,
    });
    void morph.setText("سه چهار");
    const { incoming } = layers(host);
    expect(chunks(incoming, "add")).toHaveLength(2);
    morph.destroy();
  });
});

describe("combined morph", () => {
  it("applies goo and motion blur to changed hunks while matched text stays crisp", async () => {
    const clock = installFrameClock();
    const host = createHost("سلام دنیا");
    const morph = createMorph(host, {
      morphTime: 1,
      effects: {
        goo: { blur: 0.075, threshold: 140 },
        rise: { blur: 0.1, travel: 0.3 },
      },
      autoplay: false,
    });
    const { incoming, outgoing } = layers(host);

    const promise = morph.setText("سلام جهان");
    const enter = chunks(incoming, "add");
    const matched = chunks(incoming, "match");

    expect(host.style.filter).toMatch(/^url\(#goo-morph-\d+\)$/);
    expect(host.style.filter).not.toContain("blur(0.6px)");
    expect(enter).toHaveLength(1);
    expect(matched).toHaveLength(1);
    expect(Number.parseFloat(enter[0]!.style.opacity)).toBe(0);

    clock.step(0);
    clock.frames(5, 100);

    const enterFilter = enter[0]!.style.filter;
    expect(enterFilter.match(/blur\(/g)).toHaveLength(1);
    expect(enterFilter).toMatch(/^blur\([\d.]+px\)$/);
    expect(Number.parseFloat(enter[0]!.style.opacity)).toBeGreaterThan(0);
    expect(Number.parseFloat(enter[0]!.style.opacity)).toBeLessThan(1);
    expect(matched[0]!.style.filter).toBe("none");
    expect(matched[0]!.style.opacity).toBe("1");
    expect(host.style.filter).not.toContain("blur(0.6px)");

    clock.frames(6, 100);
    await promise;

    expect(incoming.textContent).toBe("سلام جهان");
    expect(outgoing.style.opacity).toBe("0");
    expect(host.style.filter).not.toContain("blur(0.6px)");
    expect(clock.pending()).toBe(0);

    morph.destroy();
  });

  it("fast-forwards an interrupted combined morph", async () => {
    const clock = installFrameClock();
    const host = createHost("A");
    const morph = createMorph(host, {
      morphTime: 1,
      effects: { goo: true, rise: true },
      autoplay: false,
    });
    const { live } = layers(host);

    const first = morph.setText("B");
    clock.step(0);
    clock.frames(2, 100);

    const second = morph.setText("C");
    expect(live.textContent).toBe("B");

    clock.step(100);
    clock.step(100);
    clock.step(100);
    await first;
    expect(live.textContent).toBe("C");

    clock.frames(12, 100);
    await second;
    expect(live.textContent).toBe("C");
    expect(clock.pending()).toBe(0);

    morph.destroy();
  });
});

describe("reduced motion", () => {
  it("uses a short opacity cross-fade with no blur and no filter", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string): MediaQueryList =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );

    const clock = installFrameClock();
    const host = createHost("A");
    const morph = createMorph(host, {
      autoplay: false,
      morphTime: 1,
      effects: { goo: true, rise: true },
    });
    const { outgoing, incoming, live } = layers(host);

    expect(host.style.filter).toBe("none");
    expect(outgoing.style.filter).toBe("none");

    const promise = morph.setText("B");
    expect(incoming.style.filter).toBe("none");
    clock.step(0);
    clock.step(100);
    clock.step(100);
    await promise;

    expect(live.textContent).toBe("B");
    expect(host.style.filter).toBe("none");
    expect(incoming.style.filter).toBe("none");
    expect(incoming.style.opacity).toBe("1");

    morph.destroy();
  });
});

describe("frame budget", () => {
  it("does not read computed styles on every animation frame", async () => {
    const clock = installFrameClock();
    const host = createHost("سلام");
    const morph = createMorph(host, {
      morphTime: 1,
      effects: { goo: true, rise: true },
      autoplay: false,
    });
    const { incoming } = layers(host);
    const spy = vi.spyOn(window, "getComputedStyle");

    const promise = morph.setText("سلام جهان");
    const callsAfterStart = spy.mock.calls.length;
    expect(callsAfterStart).toBeLessThanOrEqual(2);

    clock.step(0);
    clock.step(100);
    clock.step(100);

    expect(spy.mock.calls.length).toBe(callsAfterStart);
    expect(chunks(incoming, "add")[0]!.style.filter).toMatch(/^blur\(/);

    clock.frames(10, 100);

    await promise;
    morph.destroy();
    spy.mockRestore();
  });
});
