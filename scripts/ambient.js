import { MODULE_ID } from "./constants.js";
import { startHop, stopHop } from "./hop.js";

let current = null;

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function dwellMs(text) {
  const n = String(text ?? "").length;
  return Math.min(9000, Math.max(1800, 900 + n * 55));
}

function canvasRect() {
  const view = canvas.app?.view ?? canvas.app?.renderer?.view;
  if (!view?.getBoundingClientRect) return null;
  return view.getBoundingClientRect();
}

function headPoint(token) {
  const mesh = token.mesh;
  const rect = canvasRect();
  if (!rect) return null;
  if (mesh && !mesh.destroyed) {
    const bounds = mesh.getBounds();
    return {
      x: rect.left + bounds.x + bounds.width / 2,
      y: rect.top + bounds.y - 6
    };
  }
  const point = canvas.stage.toGlobal(new PIXI.Point(token.center.x, token.bounds.top));
  return { x: rect.left + point.x, y: rect.top + point.y - 6 };
}

class AmbientBark {
  constructor(payload) {
    this.payload = payload;
    this.lines = payload.lines ?? [];
    this.closed = false;
    this.skip = false;
    this.root = null;
    this._tick = this.#tick.bind(this);
    this._onKey = this.#onKey.bind(this);
  }

  async start() {
    if (!this.lines.length) {
      this.payload.onClose?.();
      return;
    }
    const token = canvas.tokens?.get(this.payload.speakerTokenId);
    if (!token) {
      if (current === this) current = null;
      this.payload.onClose?.();
      return;
    }
    this.#mount();
    window.addEventListener("keydown", this._onKey, true);
    canvas.app?.ticker?.add(this._tick, null, (globalThis.PIXI?.UPDATE_PRIORITY?.LOW ?? -25) - 1);
    if ((this.payload.hop || this.payload.slide) && this.payload.speakerTokenId) {
      startHop(this.payload.speakerTokenId, {
        hop: this.payload.hop !== false,
        periodMs: this.payload.hopMs,
        durationMs: this.payload.hopDurationMs,
        slide: this.payload.slide,
        slidePx: this.payload.slidePx,
        slideMs: this.payload.slideMs
      });
    }
    this.#tick();
    for (const line of this.lines) {
      if (this.closed) return;
      this.root.textContent = line.text ?? "";
      this.root.classList.remove("is-fading");
      this.#tick();
      const wait = dwellMs(line.text);
      const started = performance.now();
      while (!this.closed && !this.skip && performance.now() - started < wait) {
        await sleep(40);
      }
      this.skip = false;
    }
    if (!this.closed) this.close();
  }

  close(immediate = false) {
    if (this.closed) return;
    this.closed = true;
    this.skip = true;
    if ((this.payload.hop || this.payload.slide) && this.payload.speakerTokenId) stopHop(this.payload.speakerTokenId);
    window.removeEventListener("keydown", this._onKey, true);
    canvas.app?.ticker?.remove(this._tick);
    const finish = () => {
      this.root?.remove();
      this.root = null;
      if (current === this) current = null;
      this.payload.onClose?.();
    };
    if (immediate || !this.root) {
      finish();
      return;
    }
    this.root.classList.add("is-fading");
    window.setTimeout(finish, 450);
  }

  #mount() {
    const root = document.createElement("div");
    root.className = "dialoguer-ambient";
    root.style.fontSize = `${this.#fontSize()}px`;
    document.body.appendChild(root);
    this.root = root;
  }

  #fontSize() {
    const base = Number(this.payload.ambientSize) || Number(game.settings.get(MODULE_ID, "ambientSize")) || 28;
    const zoom = canvas.stage?.scale?.x ?? 1;
    return Math.max(12, base * zoom);
  }

  #tick() {
    if (this.closed || !this.root) return;
    const token = canvas.tokens?.get(this.payload.speakerTokenId);
    if (!token?.visible) return;
    const point = headPoint(token);
    if (!point) return;
    this.root.style.left = `${point.x}px`;
    this.root.style.top = `${point.y}px`;
    this.root.style.fontSize = `${this.#fontSize()}px`;
  }

  #onKey(event) {
    if (event.repeat) return;
    if (event.code !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }
}

export function getActiveAmbient() {
  return current;
}

export function closeAmbient(immediate = false) {
  if (current) current.close(immediate);
}

export async function showAmbient(payload) {
  if (current) {
    current.payload.onClose = null;
    current.close(true);
  }
  const bark = new AmbientBark(payload);
  current = bark;
  await bark.start();
  return bark;
}
