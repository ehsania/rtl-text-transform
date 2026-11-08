import { describe, expect, it } from "vitest";
import { DEFAULT_RISE_EASING } from "../src/core/easing";
import {
  DEFAULT_GOO,
  DEFAULT_RISE,
  applyGooPatch,
  applyRisePatch,
  normalizeThreshold,
  resolveInitialEffects,
} from "../src/core/options";

describe("resolveInitialEffects", () => {
  it("enables goo and disables rise by default", () => {
    const effects = resolveInitialEffects(undefined);
    expect(effects.goo).toEqual(DEFAULT_GOO);
    expect(effects.goo.enabled).toBe(true);
    expect(effects.rise.enabled).toBe(false);
  });

  it("supports booleans for both effects", () => {
    const both = resolveInitialEffects({ goo: true, rise: true });
    expect(both.goo.enabled).toBe(true);
    expect(both.rise.enabled).toBe(true);

    const neither = resolveInitialEffects({ goo: false, rise: false });
    expect(neither.goo.enabled).toBe(false);
    expect(neither.rise.enabled).toBe(false);
  });

  it("merges effect objects with the defaults", () => {
    const effects = resolveInitialEffects({
      goo: { blur: 0.2, threshold: 400, maxBlur: 64 },
      rise: { travel: 0.5, scale: 2, flow: "down", minChunk: 3.9 },
    });

    expect(effects.goo.enabled).toBe(true);
    expect(effects.goo.blur).toBe(0.2);
    expect(effects.goo.maxBlur).toBe(64);
    expect(effects.goo.threshold).toBe(255);
    expect(effects.goo.atRest).toBe(DEFAULT_GOO.atRest);

    expect(effects.rise.enabled).toBe(true);
    expect(effects.rise.travel).toBe(0.5);
    expect(effects.rise.scale).toBe(1);
    expect(effects.rise.flow).toBe("down");
    expect(effects.rise.minChunk).toBe(3);
    expect(effects.rise.blur).toBe(DEFAULT_RISE.blur);
    expect(effects.rise.stagger).toBe(DEFAULT_RISE.stagger);
    expect(effects.rise.easing).toBe(DEFAULT_RISE_EASING);
  });

  it("accepts every rise flow direction", () => {
    for (const flow of ["up", "down", "left", "right"] as const) {
      expect(resolveInitialEffects({ rise: { flow } }).rise.flow).toBe(flow);
    }
  });

  it("clamps the goo blur budget into 0–100px", () => {
    expect(resolveInitialEffects(undefined).goo.maxBlur).toBe(40);
    expect(resolveInitialEffects({ goo: { maxBlur: -5 } }).goo.maxBlur).toBe(0);
    expect(resolveInitialEffects({ goo: { maxBlur: 999 } }).goo.maxBlur).toBe(100);
    expect(resolveInitialEffects({ goo: { maxBlur: Number.NaN } }).goo.maxBlur).toBe(40);
  });

  it("ignores non-finite numbers", () => {
    const effects = resolveInitialEffects({
      goo: { blur: Number.NaN, threshold: Number.POSITIVE_INFINITY },
      rise: { travel: Number.NEGATIVE_INFINITY, overlap: Number.NaN },
    });
    expect(effects.goo.blur).toBe(DEFAULT_GOO.blur);
    expect(effects.goo.threshold).toBe(DEFAULT_GOO.threshold);
    expect(effects.rise.travel).toBe(DEFAULT_RISE.travel);
    expect(effects.rise.overlap).toBe(DEFAULT_RISE.overlap);
  });
});

describe("effect patches", () => {
  it("toggles goo without losing custom settings", () => {
    const resolved = resolveInitialEffects({
      goo: { blur: 0.12, threshold: 180, atRest: false },
    });
    const disabled = applyGooPatch(resolved.goo, false);
    expect(disabled.enabled).toBe(false);
    expect(disabled.blur).toBe(0.12);

    const enabled = applyGooPatch(disabled, true);
    expect(enabled.enabled).toBe(true);
    expect(enabled.threshold).toBe(180);
    expect(enabled.atRest).toBe(false);
  });

  it("toggles rise without losing custom settings", () => {
    const resolved = resolveInitialEffects({
      rise: { travel: 0.6, stagger: 10, flow: "down" },
    });
    const disabled = applyRisePatch(resolved.rise, false);
    expect(disabled.enabled).toBe(false);
    expect(disabled.travel).toBe(0.6);

    const customEasing = (t: number) => t * t;
    const updated = applyRisePatch(disabled, {
      stagger: 70,
      easing: customEasing,
    });
    expect(updated.enabled).toBe(true);
    expect(updated.travel).toBe(0.6);
    expect(updated.stagger).toBe(70);
    expect(updated.flow).toBe("down");
    expect(updated.easing).toBe(customEasing);
  });

  it("leaves effects untouched for an undefined patch", () => {
    const resolved = resolveInitialEffects({ rise: true });
    expect(applyGooPatch(resolved.goo, undefined)).toBe(resolved.goo);
    expect(applyRisePatch(resolved.rise, undefined)).toBe(resolved.rise);
  });
});

describe("normalizeThreshold", () => {
  it("rounds and clamps into 0–255", () => {
    expect(normalizeThreshold(140.4)).toBe(140);
    expect(normalizeThreshold(-3)).toBe(0);
    expect(normalizeThreshold(999)).toBe(255);
    expect(normalizeThreshold(Number.NaN)).toBe(140);
  });
});
