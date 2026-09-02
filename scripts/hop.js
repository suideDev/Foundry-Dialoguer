import { MODULE_ID } from "./constants.js";

const hops = new Map();

function hopTarget(token) {
  return token?.mesh ?? token;
}

export function startHop(tokenId) {
  stopHop(tokenId);
  const token = canvas.tokens?.get(tokenId);
  const mesh = hopTarget(token);
  if (!mesh) return;

  const height = Number(game.settings.get(MODULE_ID, "hopHeight")) || 12;
  const originY = mesh.y;
  const started = performance.now();

  const tick = () => {
    if (!mesh.parent || mesh.destroyed) {
      stopHop(tokenId);
      return;
    }
    const t = (performance.now() - started) / 160;
    mesh.y = originY - Math.abs(Math.sin(t * Math.PI)) * height;
  };

  canvas.app.ticker.add(tick);
  hops.set(tokenId, { mesh, originY, tick });
}

export function stopHop(tokenId) {
  const hop = hops.get(tokenId);
  if (!hop) return;
  canvas.app?.ticker?.remove(hop.tick);
  if (hop.mesh && !hop.mesh.destroyed) hop.mesh.y = hop.originY;
  hops.delete(tokenId);
}

export function stopAllHops() {
  for (const tokenId of [...hops.keys()]) stopHop(tokenId);
}
