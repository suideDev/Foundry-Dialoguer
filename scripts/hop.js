import { MODULE_ID } from "./constants.js";

const hops = new Map();

function tickerPriority() {
  return globalThis.PIXI?.UPDATE_PRIORITY?.LOW ?? -25;
}

function applyOffset(token, offset) {
  if (typeof token._refreshPosition === "function") token._refreshPosition();
  const mesh = token.mesh;
  if (!mesh) return;
  mesh.position.y -= offset;
}

export function startHop(tokenId) {
  stopHop(tokenId);
  const token = canvas.tokens?.get(tokenId);
  if (!token) return;

  const height = Number(game.settings.get(MODULE_ID, "hopHeight")) || 16;
  const started = performance.now();

  const tick = () => {
    const current = canvas.tokens?.get(tokenId);
    if (!current?.mesh || current.mesh.destroyed) {
      stopHop(tokenId);
      return;
    }
    const bounce = Math.abs(Math.sin(((performance.now() - started) / 160) * Math.PI)) * height;
    applyOffset(current, bounce);
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
