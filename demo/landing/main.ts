import { mountBento } from "./bento";
import { initShell } from "./shell";

function initBento(): void {
  const root = document.getElementById("bento-root");
  if (!root) return;
  root.append(mountBento());
}

initShell();
initBento();
