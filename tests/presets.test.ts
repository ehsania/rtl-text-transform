import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMorph,
  firstNumber,
  flowByHunkPosition,
  flowByNumberChange,
  motions,
  presets,
  resolvePreset,
} from "../src/index";
import type { MorphOptions, RiseEffectOptions, RiseFlowContext } from "../src/index";
import { createHost, installFrameClock } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function hunk(position: number) {
  return {
    id: "chunk-0",
    kind: "add" as const,
    text: "x",
    start: 0,
    end: 1,
    length: 1,
    position,
  };
}

function context(from: string, to: string, rtl = true, position = 0.9): RiseFlowContext {
  return { from, to, dir: rtl ? "rtl" : "ltr", rtl, hunk: hunk(position) };
}

describe("preset resolution", () => {
  it("applies the default motion when a content preset is used", () => {
    const resolved = resolvePreset("numbers");
    expect(resolved.morphTime).toBe(0.3);
    const rise = resolved.effects?.rise as RiseEffectOptions;
    expect(rise.blur).toBe(0.1);
    expect(rise.travel).toBe(0.6);
    expect(rise.scale).toBe(0.9);
    expect(rise.stagger).toBe(70);
    expect(rise.overlap).toBe(0);
    expect(typeof rise.flow).toBe("function");
  });

  it("merges motion and inline overrides over the content preset", () => {
    const resolved = resolvePreset("numbers", {
      motion: "snappy",
      words: ["۳", "۴"],
      effects: {
        goo: false,
        rise: { blur: 0.14, flow: "down" },
      },
    });

    expect(resolved.morphTime).toBe(0.2);
    expect(resolved.words).toEqual(["۳", "۴"]);
    expect(resolved.effects?.goo).toBe(false);

    const rise = resolved.effects?.rise as RiseEffectOptions;
    expect(rise.blur).toBe(0.14);
    expect(rise.travel).toBe(0.6);
    expect(rise.stagger).toBe(50);
    expect(rise.flow).toBe("down");
  });

  it("does not mutate the exported preset definitions", () => {
    const original = presets.numbers.effects?.rise as RiseEffectOptions;
    const before = original.blur;
    resolvePreset("numbers", {
      effects: { rise: { blur: 0.2, flow: "up" } },
    });
    expect(original.blur).toBe(before);
    expect(typeof original.flow).toBe("function");
  });

  it("exposes the four motion presets", () => {
    expect(Object.keys(motions)).toEqual(["default", "smooth", "snappy", "gentle"]);
    expect(motions.default.morphTime).toBe(0.3);
    expect(motions.snappy.morphTime).toBe(0.2);
  });

  it("keeps plain options unchanged when no preset is used", () => {
    const options: MorphOptions = {
      morphTime: 1.4,
      effects: { goo: true },
    };
    const resolved = resolvePreset("wordsUp", options);
    expect(resolved.morphTime).toBe(1.4);
    expect(resolved.effects?.goo).toBe(true);
  });
});

describe("number flow", () => {
  it("parses Persian, Arabic-Indic and Latin digits", () => {
    expect(firstNumber("۳ مورد")).toBe(3);
    expect(firstNumber("٤ عناصر")).toBe(4);
    expect(firstNumber("items: 12")).toBe(12);
    expect(firstNumber("− not a number")).toBeUndefined();
  });

  it("moves up when the value increases and down when it decreases", () => {
    expect(flowByNumberChange(context("۳", "۴"))).toBe("up");
    expect(flowByNumberChange(context("۴", "۳"))).toBe("down");
    expect(flowByNumberChange(context("۳", "۳"))).toBe("up");
    expect(flowByNumberChange(context("no number", "still none"))).toBe("up");
  });
});

describe("word flow", () => {
  it("moves a hunk toward the edge it belongs to", () => {
    expect(flowByHunkPosition(context("ab", "abc", true, 0.9))).toBe("left");
    expect(flowByHunkPosition(context("abc", "bc", true, 0.1))).toBe("right");
    expect(flowByHunkPosition(context("ab", "abc", false, 0.9))).toBe("right");
    expect(flowByHunkPosition(context("abc", "bc", false, 0.1))).toBe("left");
  });

  it("treats the exact centre as the end side", () => {
    expect(flowByHunkPosition(context("ab", "ac", true, 0.5))).toBe("left");
    expect(flowByHunkPosition(context("ab", "ac", false, 0.5))).toBe("right");
  });
});

describe("per-hunk controller flow", () => {
  it("resolves flow once for each changed chunk", () => {
    installFrameClock();
    const host = createHost("ab");
    const calls: RiseFlowContext[] = [];

    const morph = createMorph(host, {
      dir: "ltr",
      lang: "en",
      autoplay: false,
      morphTime: 1,
      effects: {
        rise: {
          flow: (flowContext) => {
            calls.push(flowContext);
            return "left";
          },
        },
      },
    });

    void morph.setText("abc");
    const first = calls[0];
    expect(first?.from).toBe("ab");
    expect(first?.to).toBe("abc");
    expect(first?.hunk.position).toBeGreaterThan(0.5);
    expect(calls).toHaveLength(1);
    morph.destroy();
  });

  it("switches content and motion presets through update()", () => {
    const host = createHost("۳");
    const morph = createMorph(host, {
      preset: "numbers",
      motion: "default",
      words: ["۳", "۴"],
      autoplay: false,
    });

    expect(() => {
      morph.update({
        preset: "wordsHorizontal",
        motion: "gentle",
        effects: { goo: false },
      });
      morph.update({ motion: "snappy" });
    }).not.toThrow();

    morph.destroy();
  });
});
