import { FLAG_CONFIG, MODULE_ID, getConfig, isAuthority, isPlayerOwnedToken, pointInTile, tokenCenter } from "./constants.js";
import { playFromDocument } from "./play.js";

const priorPositions = new WeakMap();

export function registerTileTriggers() {
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
    void considerTileEntry(doc, prior);
  });
}

async function considerTileEntry(tokenDoc, prior) {
  const scene = tokenDoc.parent;
  if (!scene) return;
  const now = tokenCenter(tokenDoc);
  const size = scene.grid?.size ?? 100;
  const was = {
    x: prior.x + (prior.width * size) / 2,
    y: prior.y + (prior.height * size) / 2
  };

  const tiles = scene.tiles.filter((tile) => {
    const config = tile.getFlag(MODULE_ID, FLAG_CONFIG);
    return config?.enabled && getConfig(tile).enabled;
  });

  for (const tile of tiles) {
    const insideNow = pointInTile(now, tile);
    const insideWas = pointInTile(was, tile);
    if (!insideNow || insideWas) continue;
    const config = getConfig(tile);
    if (config.playerTokensOnly && !isPlayerOwnedToken(tokenDoc)) continue;
    await playFromDocument(tile, { triggeringToken: tokenDoc });
  }
}
