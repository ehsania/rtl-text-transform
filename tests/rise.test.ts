import { describe, expect, it } from "vitest";
import {
  enterProgress,
  enterTransform,
  exitProgress,
  exitTransform,
  riseTiming,
} from "../src/core/effects/rise";

describe("riseTiming", () => {
  it("fits all hunks inside the shared morph duration", () => {
    const timing = riseTiming(1, 3, 35, 0.15);
    expect(timing.stagger).toBeCloseTo(0.035, 6);
    expect(timing.overlap).toBe(0.15);
    expect(timing.window).toBeCloseTo((1 - 0.07) / 1.15, 6);
  });

  it("scales the stagger down when many hunks would overflow", () => {
    const timing = riseTiming(0.5, 21, 50, 0);
    expect(timing.stagger).toBeCloseTo((0.5 * 0.35) / 20, 6);
    expect(timing.window).toBeCloseTo(0.5 - 20 * timing.stagger, 6);
  });

  it("never staggers a single hunk", () => {
    const timing = riseTiming(1, 1, 35, 0.15);
    expect(timing.stagger).toBe(0);
    expect(timing.window).toBeCloseTo(1 / 1.15, 6);
  });

  it("handles a zero duration without dividing by zero", () => {
    const timing = riseTiming(0, 4, 35, 0.15);
    expect(timing.window).toBe(0);
    expect(enterProgress(0, 2, timing)).toBe(1);
    expect(exitProgress(0, 2, timing)).toBe(1);
  });
});

describe("enterProgress", () => {
  it("respects stagger and overlap delays", () => {
    const timing = riseTiming(1, 2, 35, 0.15);
    const firstStart = timing.window * timing.overlap;
    const secondStart = timing.stagger + firstStart;
    expect(enterProgress(0, 0, timing)).toBe(0);
    expect(enterProgress(firstStart, 0, timing)).toBe(0);
    expect(enterProgress(firstStart + timing.window / 2, 0, timing)).toBeCloseTo(0.5, 6);
    expect(enterProgress(secondStart, 1, timing)).toBe(0);
    expect(enterProgress(secondStart + timing.window / 2, 1, timing)).toBeCloseTo(0.5, 6);
    expect(enterProgress(1, 1, timing)).toBe(1);
  });
});

describe("exitProgress", () => {
  it("leaves earlier and runs for 70% of the enter window", () => {
    const timing = riseTiming(1, 2, 35, 0);
    expect(exitProgress(0, 0, timing)).toBe(0);
    expect(exitProgress(timing.window * 0.35, 0, timing)).toBeCloseTo(0.5, 6);
    expect(exitProgress(timing.stagger, 1, timing)).toBe(0);
  });
});

describe("rise transforms", () => {
  it("enters from below and settles at identity", () => {
    expect(enterTransform(0, 0.3, 0.94, 0.1, "up")).toEqual({
      xEm: 0,
      yEm: 0.3,
      scale: 0.94,
      blurEm: 0.1,
    });
    expect(enterTransform(1, 0.3, 0.94, 0.1, "up")).toEqual({
      xEm: 0,
      yEm: 0,
      scale: 1,
      blurEm: 0,
    });
  });

  it("exits upward with a reduced travel", () => {
    expect(exitTransform(0, 0.3, 0.94, 0.1, "up")).toEqual({
      xEm: 0,
      yEm: 0,
      scale: 1,
      blurEm: 0,
    });
    expect(exitTransform(1, 0.3, 0.94, 0.1, "up")).toEqual({
      xEm: 0,
      yEm: -0.18,
      scale: 0.94,
      blurEm: 0.1,
    });
  });

  it("reverses the vertical direction for flow down", () => {
    expect(enterTransform(0, 0.3, 1, 0.1, "down")).toEqual({
      xEm: 0,
      yEm: -0.3,
      scale: 1,
      blurEm: 0.1,
    });
    expect(exitTransform(1, 0.3, 1, 0.1, "down")).toEqual({
      xEm: 0,
      yEm: 0.18,
      scale: 1,
      blurEm: 0.1,
    });
  });

  it("moves horizontally for flow left and right", () => {
    expect(enterTransform(0, 0.3, 1, 0.1, "left")).toEqual({
      xEm: 0.3,
      yEm: 0,
      scale: 1,
      blurEm: 0.1,
    });
    expect(exitTransform(1, 0.3, 1, 0.1, "left")).toEqual({
      xEm: -0.18,
      yEm: 0,
      scale: 1,
      blurEm: 0.1,
    });

    expect(enterTransform(0, 0.3, 1, 0.1, "right")).toEqual({
      xEm: -0.3,
      yEm: 0,
      scale: 1,
      blurEm: 0.1,
    });
    expect(exitTransform(1, 0.3, 1, 0.1, "right")).toEqual({
      xEm: 0.18,
      yEm: 0,
      scale: 1,
      blurEm: 0.1,
    });
  });
});
