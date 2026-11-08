import { describe, expect, it } from "vitest";
import {
  DEFAULT_MORPH_EASING,
  DEFAULT_RISE_EASING,
  cubicBezier,
  easeInOutCubic,
  easeOutCubic,
  linear,
} from "../src/core/easing";

describe("easing curves", () => {
  it("hits the endpoints", () => {
    for (const curve of [linear, easeOutCubic, easeInOutCubic]) {
      expect(curve(0)).toBe(0);
      expect(curve(1)).toBe(1);
    }
  });

  it("handles values outside 0..1 as endpoints", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeInOutCubic(-1)).toBe(0);
    expect(easeInOutCubic(2)).toBe(1);
  });

  it("passes through the midpoint", () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.8722, 3);
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });

  it("solves arbitrary cubic-bezier curves", () => {
    const identity = cubicBezier(0, 0, 1, 1);
    for (let step = 0; step <= 10; step += 1) {
      const t = step / 10;
      expect(identity(t)).toBeCloseTo(t, 6);
    }
    expect(cubicBezier(0.65, 0, 0.35, 1)(0.5)).toBe(0.5);
  });

  it("is monotonic", () => {
    for (const curve of [easeOutCubic, easeInOutCubic]) {
      let previous = -1;
      for (let step = 0; step <= 100; step += 1) {
        const value = curve(step / 100);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });

  it("is symmetric for the overall morph curve", () => {
    for (let step = 0; step <= 20; step += 1) {
      const t = step / 20;
      expect(easeInOutCubic(t) + easeInOutCubic(1 - t)).toBeCloseTo(1, 6);
    }
  });

  it("exposes non-linear defaults", () => {
    expect(DEFAULT_MORPH_EASING).toBe(easeInOutCubic);
    expect(DEFAULT_RISE_EASING).toBe(easeOutCubic);
    expect(DEFAULT_MORPH_EASING(0.25)).not.toBeCloseTo(0.25, 2);
    expect(DEFAULT_RISE_EASING(0.25)).not.toBeCloseTo(0.25, 2);
  });
});
