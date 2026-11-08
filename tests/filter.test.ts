import { afterEach, describe, expect, it } from "vitest";
import { acquireGooFilter, getFilterElement, getFilterRefCount } from "../src/core/filter";
import { createMorph } from "../src/index";
import { createHost } from "./helpers";

afterEach(() => {
  document.body.replaceChildren();
});

describe("goo filter registry", () => {
  it("creates a filter once per threshold with unique ids", () => {
    const first = acquireGooFilter(140);
    const second = acquireGooFilter(140);
    const other = acquireGooFilter(160);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(other).not.toBeNull();
    expect(first!.id).toBe(second!.id);
    expect(other!.id).not.toBe(first!.id);
    expect(first!.id).toMatch(/^goo-morph-\d+$/);
    expect(getFilterRefCount(140)).toBe(2);
    expect(getFilterRefCount(160)).toBe(1);

    const filter = getFilterElement(140);
    expect(filter).not.toBeNull();
    expect(filter!.getAttribute("values") ?? "").toBe("");

    const matrix = filter!.querySelector("feColorMatrix");
    expect(matrix?.getAttribute("values")).toContain("0 0 0 255 -140");

    first!.release();
    expect(getFilterRefCount(140)).toBe(1);
    expect(getFilterElement(140)).not.toBeNull();

    second!.release();
    other!.release();
    expect(getFilterRefCount(140)).toBe(0);
    expect(getFilterRefCount(160)).toBe(0);
    expect(document.querySelector('filter[id^="goo-morph-"]')).toBeNull();
  });

  it("ignores duplicate releases", () => {
    const handle = acquireGooFilter(140)!;
    handle.release();
    handle.release();
    expect(getFilterRefCount(140)).toBe(0);
  });

  it("does not create a filter when goo is disabled", () => {
    const host = createHost("سلام");
    const morph = createMorph(host, {
      effects: { goo: false },
      autoplay: false,
    });

    expect(getFilterRefCount(140)).toBe(0);
    expect(document.querySelector('filter[id^="goo-morph-"]')).toBeNull();
    expect(host.style.filter).toBe("none");

    morph.destroy();
  });

  it("removes the filter when a single morph is destroyed", () => {
    const host = createHost("سلام");
    const morph = createMorph(host, {
      effects: { goo: { threshold: 140 } },
      autoplay: false,
    });

    expect(getFilterRefCount(140)).toBe(1);
    expect(document.querySelector('filter[id^="goo-morph-"]')).not.toBeNull();

    morph.destroy();

    expect(getFilterRefCount(140)).toBe(0);
    expect(document.querySelector('filter[id^="goo-morph-"]')).toBeNull();
  });

  it("reference-counts two instances sharing a threshold", () => {
    const first = createMorph(createHost("یک"), {
      effects: { goo: { threshold: 140 } },
      autoplay: false,
    });
    const second = createMorph(createHost("دو"), {
      effects: { goo: { threshold: 140 } },
      autoplay: false,
    });

    expect(getFilterRefCount(140)).toBe(2);
    expect(document.querySelectorAll('filter[id^="goo-morph-"]')).toHaveLength(1);

    first.destroy();
    expect(getFilterRefCount(140)).toBe(1);
    expect(document.querySelector('filter[id^="goo-morph-"]')).not.toBeNull();

    second.destroy();
    expect(getFilterRefCount(140)).toBe(0);
    expect(document.querySelector('filter[id^="goo-morph-"]')).toBeNull();
  });

  it("swaps filters when the threshold is updated", () => {
    const host = createHost("سلام");
    const morph = createMorph(host, {
      effects: { goo: { threshold: 140 } },
      autoplay: false,
    });
    const oldId = getFilterElement(140)?.id;

    morph.update({ effects: { goo: { threshold: 160 } } });

    expect(getFilterRefCount(140)).toBe(0);
    expect(getFilterRefCount(160)).toBe(1);
    expect(getFilterElement(160)?.id).not.toBe(oldId);
    expect(host.style.filter).toContain(`#${getFilterElement(160)!.id}`);

    morph.destroy();
    expect(getFilterRefCount(160)).toBe(0);
  });

  it("releases and re-acquires the filter when goo is toggled", () => {
    const host = createHost("سلام");
    const morph = createMorph(host, {
      effects: { goo: { threshold: 140 } },
      autoplay: false,
    });

    expect(getFilterRefCount(140)).toBe(1);

    morph.update({ effects: { goo: false } });
    expect(getFilterRefCount(140)).toBe(0);
    expect(host.style.filter).toBe("none");

    morph.update({ effects: { goo: true } });
    expect(getFilterRefCount(140)).toBe(1);
    expect(host.style.filter).toContain("url(#goo-morph-");

    morph.destroy();
    expect(getFilterRefCount(140)).toBe(0);
  });
});
