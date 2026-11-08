import { describe, expect, it } from "vitest";
import { combineBlur } from "../src/core/transition";

describe("combineBlur", () => {
  it("composes two gaussian radii into one filter pass", () => {
    expect(combineBlur(3, 4)).toBe("blur(5.00px)");
  });

  it("never emits more than one blur function", () => {
    expect(combineBlur(10, 0.5).match(/blur\(/g)).toHaveLength(1);
  });

  it("returns none when both radii are negligible", () => {
    expect(combineBlur(0, 0)).toBe("none");
    expect(combineBlur(0.005, 0.005)).toBe("none");
  });
});
