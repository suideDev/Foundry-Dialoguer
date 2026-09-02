import { getConfig, isAuthority, isPlayerOwnedToken, pointInTile, tokenCenter } from "./constants.js";
import { playFromDocument } from "./play.js";

const recent = new Map();

export function registerTileTriggers() {
  Hooks.on("moveToken", (doc, movement) => {
    if (!isAuthority()) return;
    const origin = movement?.origin;
    const destination = movement?.destination;
    if (!origin || !destination) return;
    void considerTileEntry(doc, origin, destination);
  });

  const priorPositions = new WeakMap();
  Hooks.on("preUpdateToken", (doc, changes) => {
    if (!("x" in changes || "y" in changes)) return;
    priorPositions.set(doc, { x: doc.x, y: doc.y, width: doc.width, height: doc.height });
  });

  Hooks.on("updateToken", (doc, changes) => {
    if (!("x" in changes || "y" in changes)) return;
    if (!isAuthority()) return;
    const prior = priorPositions.get(doc);
    priorPositions.delete(doc);
    if (!prior) return;
    const destination = {
      x: doc._source?.x ?? doc.x,
      y: doc._source?.y ?? doc.y,
      width: doc.width,
      height: doc.height
    };
    void considerTileEntry(doc, prior, destination);
  });
}

async function considerTileEntry(tokenDoc, origin, destination) {
  const scene = tokenDoc.parent;
  if (!scene) return;
  const now = tokenCenter(tokenDoc, destination);
  const was = tokenCenter(tokenDoc, origin);

  const tiles = scene.tiles.filter((tile) => getConfig(tile).enabled);

  for (const tile of tiles) {
    const insideNow = pointInTile(now, tile);
    const insideWas = pointInTile(was, tile);
    if (!insideNow || insideWas) continue;
    const config = getConfig(tile);
    if (config.playerTokensOnly && !isPlayerOwnedToken(tokenDoc)) continue;
    const key = `${tokenDoc.id}:${tile.id}:${Math.round(now.x)}:${Math.round(now.y)}`;
    const last = recent.get(key) ?? 0;
    if (Date.now() - last < 500) continue;
    recent.set(key, Date.now());
    await playFromDocument(tile, { triggeringToken: tokenDoc });
  }
}
