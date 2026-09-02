import {
  SOCKET_EVENT,
  getConfig,
  isAuthority,
  isPlayerOwnedToken,
  normalizeTokenPoint,
  tokenOverlapsTile
} from "./constants.js";
import { playFromDocument } from "./play.js";

const occupancy = new Map();
const lastPlaceable = new WeakMap();
const enabledTilesByScene = new WeakMap();

export function registerTileTriggers() {
  Hooks.on("moveToken", (doc, movement, _operation, user) => {
    const userId = typeof user === "string" ? user : user?.id;
    handleCompletedMovement(doc, movement, userId);
  });

  Hooks.on("refreshToken", (token) => {
    if (!isLiveToken(token)) return;
    const tiles = enabledTiles(token.document.parent);
    if (!tiles.length) return;
    const x = token.x;
    const y = token.y;
    const prev = lastPlaceable.get(token);
    if (prev && prev.x === x && prev.y === y) return;
    lastPlaceable.set(token, { x, y });
    const size = token.document.parent?.grid?.size ?? 100;
    const point = {
      x,
      y,
      width: (token.w || token.document.width * size) / size,
      height: (token.h || token.document.height * size) / size
    };
    considerPoints(token.document, [point], game.user.id);
  });

  Hooks.on("canvasReady", (canvas) => snapshotScene(canvas.scene));
  Hooks.on("createToken", (doc) => snapshotToken(doc));
  Hooks.on("deleteToken", (doc) => clearToken(doc));
  Hooks.on("createTile", (tile) => invalidateTiles(tile.parent));
  Hooks.on("updateTile", (tile) => invalidateTiles(tile.parent));
  Hooks.on("deleteTile", (tile) => invalidateTiles(tile.parent));

  if (canvas?.ready) snapshotScene(canvas.scene);

  game.socket.on(SOCKET_EVENT, (message) => {
    if (message?.action !== "tileEnter") return;
    if (!isAuthority()) return;
    const scene = game.scenes.get(message.sceneId);
    const token = scene?.tokens.get(message.tokenId);
    if (!token) return;
    considerPoints(token, message.points ?? [], message.userId, { emit: false });
  });
}

function isLiveToken(token) {
  if (!token?.document?.parent) return false;
  if (token.isPreview || token._original) return false;
  if (token.isDragged) return false;
  if (token.previewType === "dragging") return false;
  return Boolean(token.document.parent.tokens.get(token.document.id));
}

function enabledTiles(scene) {
  if (!scene) return [];
  let tiles = enabledTilesByScene.get(scene);
  if (!tiles) {
    tiles = scene.tiles.filter((tile) => getConfig(tile).enabled);
    enabledTilesByScene.set(scene, tiles);
  }
  return tiles;
}

function invalidateTiles(scene) {
  if (scene) enabledTilesByScene.delete(scene);
}

function occupancyKey(tokenId, tileId) {
  return `${tokenId}:${tileId}`;
}

function snapshotScene(scene) {
  if (!scene) return;
  for (const token of scene.tokens) snapshotToken(token);
}

function snapshotToken(tokenDoc) {
  const scene = tokenDoc?.parent;
  if (!scene) return;
  const point = { x: tokenDoc.x, y: tokenDoc.y, width: tokenDoc.width, height: tokenDoc.height };
  for (const tile of enabledTiles(scene)) {
    occupancy.set(occupancyKey(tokenDoc.id, tile.id), tokenOverlapsTile(tokenDoc, point, tile));
  }
}

function clearToken(tokenDoc) {
  const prefix = `${tokenDoc.id}:`;
  for (const key of occupancy.keys()) {
    if (key.startsWith(prefix)) occupancy.delete(key);
  }
}

function addPoint(points, seen, tokenDoc, raw) {
  const point = normalizeTokenPoint(tokenDoc, raw);
  if (!point) return;
  const key = `${point.x}:${point.y}:${point.width}:${point.height}`;
  if (seen.has(key)) return;
  seen.add(key);
  points.push(point);
}

function completedPoints(tokenDoc, movement) {
  const points = [];
  const seen = new Set();
  for (const waypoint of movement?.passed?.waypoints ?? []) addPoint(points, seen, tokenDoc, waypoint);
  if (!(movement?.pending?.waypoints ?? []).length) {
    addPoint(points, seen, tokenDoc, movement?.destination);
  }
  return points;
}

function handleCompletedMovement(doc, movement, userId) {
  if (movement?.state === "planned") return;
  const points = completedPoints(doc, movement);
  if (!points.length) return;
  considerPoints(doc, points, userId);
}

function canTrigger(tokenDoc, config, userId) {
  if (!config.playerTokensOnly) return true;
  if (isPlayerOwnedToken(tokenDoc)) return true;
  const mover = game.users.get(userId);
  return Boolean(mover && !mover.isGM);
}

function considerPoints(tokenDoc, points, userId, { emit = true } = {}) {
  const scene = tokenDoc.parent;
  if (!scene) return;
  const tiles = enabledTiles(scene);
  if (!tiles.length) return;

  const normalized = [];
  for (const raw of points ?? []) {
    const point = normalizeTokenPoint(tokenDoc, raw);
    if (point) normalized.push(point);
  }
  if (!normalized.length) return;

  const enteredTiles = [];
  for (const tile of tiles) {
    const key = occupancyKey(tokenDoc.id, tile.id);
    let inside = occupancy.get(key) ?? false;
    let entered = false;
    for (const point of normalized) {
      const now = tokenOverlapsTile(tokenDoc, point, tile);
      if (now && !inside) entered = true;
      inside = now;
    }
    occupancy.set(key, inside);
    if (entered) enteredTiles.push(tile);
  }

  if (!enteredTiles.length) return;

  if (!isAuthority()) {
    if (!emit || userId !== game.user.id) return;
    game.socket.emit(SOCKET_EVENT, {
      action: "tileEnter",
      sceneId: scene.id,
      tokenId: tokenDoc.id,
      points: normalized,
      userId
    });
    return;
  }

  for (const tile of enteredTiles) {
    const config = getConfig(tile);
    if (!canTrigger(tokenDoc, config, userId)) continue;
    void playFromDocument(tile, { triggeringToken: tokenDoc });
  }
}
