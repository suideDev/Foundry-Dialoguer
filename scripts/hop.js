import { MODULE_ID } from "./constants.js";

const hops = new Map();

function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function tickerPriority() {
  return globalThis.PIXI?.UPDATE_PRIORITY?.LOW ?? -25;
}

function applyOffset(token, bounce, sway) {
  if (typeof token._refreshPosition === "function") token._refreshPosition();
  const mesh = token.mesh;
  if (!mesh) return;
  if (bounce) mesh.position.y -= bounce;
  if (sway) mesh.position.x += sway;
}

export function startHop(tokenId, options = {}) {
  stopHop(tokenId);
  const token = canvas.tokens?.get(tokenId);
  if (!token) return;

  const hopOn = options.hop !== false;
  const slideOn = options.slide === true;
  if (!hopOn && !slideOn) return;

  const height = hopOn ? positiveNumber(game.settings.get(MODULE_ID, "hopHeight"), 16) : 0;
  const period = Math.max(40, positiveNumber(options.periodMs, positiveNumber(game.settings.get(MODULE_ID, "hopMs"), 160)));
  const slide = slideOn
    ? Math.max(0, finiteNumber(options.slidePx, finiteNumber(game.settings.get(MODULE_ID, "slidePx"), 8)))
    : 0;
  const slidePeriod = Math.max(40, positiveNumber(options.slideMs, positiveNumber(game.settings.get(MODULE_ID, "slideMs"), 320)));
  const duration = Number(options.durationMs);
  const started = performance.now();

  const tick = () => {
    const current = canvas.tokens?.get(tokenId);
    if (!current?.mesh || current.mesh.destroyed) {
      stopHop(tokenId);
      return;
    }
    const elapsed = performance.now() - started;
    if (duration > 0 && elapsed >= duration) {
      stopHop(tokenId);
      return;
    }
    const bounce = height ? Math.abs(Math.sin((elapsed / period) * Math.PI)) * height : 0;
    const sway = slide ? Math.sin((elapsed / slidePeriod) * Math.PI * 2) * slide : 0;
    applyOffset(current, bounce, sway);
  };

  canvas.app.ticker.add(tick, null, tickerPriority());
  hops.set(tokenId, { tick });
}

export function stopHop(tokenId) {
  const hop = hops.get(tokenId);
  if (!hop) return;
  canvas.app?.ticker?.remove(hop.tick);
  hops.delete(tokenId);
  const token = canvas.tokens?.get(tokenId);
  if (token && typeof token._refreshPosition === "function") token._refreshPosition();
}

export function stopAllHops() {
  for (const tokenId of [...hops.keys()]) stopHop(tokenId);
}
