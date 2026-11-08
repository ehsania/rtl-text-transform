import { describe, expect, it } from "vitest";
import {
  MAX_BLUR_PX,
  blurForFraction,
  canAdvance,
  clamp01,
  cycleDuration,
  cyclePosition,
  opacityForFraction,
  thresholdMatrix,
  visualForFraction,
  wrapIndex,
} from "../src/core/math";

describe("blurForFraction", () => {
  it("hits the demo endpoints", () => {
    expect(blurForFraction(0, 100, 0.075)).toBe(MAX_BLUR_PX);
    expect(blurForFraction(1, 100, 0.075)).toBe(0);
  });

  it("follows blurEm * fontSize * (1 / f - 1)", () => {
    expect(blurForFraction(0.5, 100, 0.075)).toBeCloseTo(7.5, 6);
    expect(blurForFraction(0.25, 50, 0.1)).toBeCloseTo(15, 6);
  });

  it("clamps large blurs at 100px", () => {
    expect(blurForFraction(0.5, 100, 10)).toBe(MAX_BLUR_PX);
    expect(blurForFraction(0.0001, 400, 1)).toBe(MAX_BLUR_PX);
  });

  it("is monotonic as the layer becomes sharper", () => {
    const samples = [0, 0.01, 0.1, 0.25, 0.5, 0.75, 0.99, 1].map((f) =>
      blurForFraction(f, 120, 0.075),
    );
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]!).toBeLessThanOrEqual(samples[index - 1]!);
    }
  });
});

describe("opacityForFraction", () => {
  it("hits the endpoints", () => {
    expect(opacityForFraction(0)).toBe(0);
    expect(opacityForFraction(1)).toBe(1);
  });

  it("is monotonic and uses the 0.4 exponent", () => {
    expect(opacityForFraction(0.5)).toBeCloseTo(Math.pow(0.5, 0.4), 12);
    let previous = -1;
    for (let step = 0; step <= 100; step += 1) {
      const value = opacityForFraction(step / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("visualForFraction", () => {
  it("combines blur and opacity", () => {
    expect(visualForFraction(1, 100, 0.075)).toEqual({
      blurPx: 0,
      opacity: 1,
    });
    const half = visualForFraction(0.5, 100, 0.075);
    expect(half.blurPx).toBeCloseTo(7.5, 6);
    expect(half.opacity).toBeCloseTo(Math.pow(0.5, 0.4), 12);
  });
});

describe("clamp01 and thresholdMatrix", () => {
  it("clamps and handles NaN", () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it("builds the documented alpha row", () => {
    expect(thresholdMatrix(140)).toContain("0 0 0 255 -140");
    expect(thresholdMatrix(-10)).toContain("0 0 0 255 -0");
    expect(thresholdMatrix(999)).toContain("0 0 0 255 -255");
  });
});

describe("cycle timing", () => {
  it("rests first, then morphs", () => {
    expect(cycleDuration(1, 0.25)).toBe(1.25);
    expect(cyclePosition(0, 1, 0.25)).toEqual({
      cycleIndex: 0,
      fraction: 0,
      atRest: true,
    });
    expect(cyclePosition(0.25, 1, 0.25).fraction).toBe(0);
    expect(cyclePosition(0.75, 1, 0.25).fraction).toBeCloseTo(0.5, 12);
    expect(cyclePosition(1.25, 1, 0.25)).toEqual({
      cycleIndex: 1,
      fraction: 0,
      atRest: true,
    });
    expect(cyclePosition(2.5, 1, 0.25).fraction).toBe(0);
    expect(cyclePosition(3.5, 1, 0.25).fraction).toBeCloseTo(0.75, 12);
  });

  it("wraps and clamps indexes", () => {
    expect(wrapIndex(3, 3, true)).toBe(0);
    expect(wrapIndex(-1, 3, true)).toBe(2);
    expect(wrapIndex(3, 3, false)).toBe(2);
    expect(canAdvance(2, 3, false)).toBe(false);
    expect(canAdvance(2, 3, true)).toBe(true);
  });
});
