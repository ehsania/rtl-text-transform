import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MorphText } from "../src/react";
import { installFrameClock, layers } from "./helpers";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("MorphText", () => {
  it("creates the core on mount and morphs controlled text updates", async () => {
    const clock = installFrameClock();
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(MorphText, {
          text: "سلام",
          dir: "rtl",
          lang: "fa",
          autoplay: false,
          morphTime: 1,
          style: { fontSize: "100px" },
        }),
      );
    });

    const host = container.firstElementChild as HTMLElement | null;
    expect(host).not.toBeNull();
    const view = layers(host!);
    expect(view.live.textContent).toBe("سلام");
    expect(host!.getAttribute("dir")).toBe("rtl");
    expect(host!.style.filter).toContain("url(#goo-morph-");

    await act(async () => {
      root.render(
        createElement(MorphText, {
          text: "درود",
          dir: "rtl",
          lang: "fa",
          autoplay: false,
          morphTime: 1,
          style: { fontSize: "100px" },
        }),
      );
    });

    clock.step(0);
    clock.frames(11, 100);
    await act(async () => undefined);

    expect(view.live.textContent).toBe("درود");

    await act(async () => {
      root.unmount();
    });
    expect(container.querySelector("[data-morph-layer]")).toBeNull();
  });

  it("forwards nested effect options and keeps rise-only output filterless", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(MorphText, {
          words: ["یک", "دو"],
          dir: "rtl",
          lang: "fa",
          autoplay: false,
          effects: { goo: false, rise: true },
          style: { fontSize: "100px" },
        }),
      );
    });

    const host = container.firstElementChild as HTMLElement;
    const view = layers(host);
    expect(view.live.textContent).toBe("یک");
    expect(host.style.filter).toBe("none");
    expect(host.hasAttribute("effects")).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("forwards preset and motion props without leaking DOM attributes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(MorphText, {
          preset: "numbers",
          motion: "snappy",
          words: ["۳", "۴"],
          dir: "rtl",
          lang: "fa",
          autoplay: false,
          style: { fontSize: "100px" },
        }),
      );
    });

    const host = container.firstElementChild as HTMLElement;
    expect(layers(host).live.textContent).toBe("۳");
    expect(host.hasAttribute("preset")).toBe(false);
    expect(host.hasAttribute("motion")).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });
});

describe("MorphText with a controlled undefined text", () => {
  it("renders a plain host and lets the core use words", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        createElement(MorphText, {
          words: ["الف"],
          autoplay: false,
          effects: { goo: false },
          id: "host",
        }),
      );
    });

    const host = container.firstElementChild as HTMLElement;
    expect(host.id).toBe("host");
    expect(layers(host).live.textContent).toBe("الف");

    await act(async () => {
      root.unmount();
    });
  });
});
