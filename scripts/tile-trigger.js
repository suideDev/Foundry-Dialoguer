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
  Hooks.on("preMoveToken", (doc, movement) => {
    handleMovement(doc, movement, game.user.id);
  });

  Hooks.on("moveToken", (doc, movement, _operation, user) => {
    const userId = typeof user === "string" ? user : user?.id;
    handleMovement(doc, movement, userId);
  });

  const priorPositions = new WeakMap();
  Hooks.on("preUpdateToken", (doc, changes) => {
    if (!("x" in changes || "y" in changes)) return;
    priorPositions.set(doc, { x: doc.x, y: doc.y, width: doc.width, height: doc.height });
  });

  Hooks.on("updateToken", (doc, changes) => {
    if (!("x" in changes || "y" in changes)) return;
    const prior = priorPositions.get(doc);
    priorPositions.delete(doc);
    const destination = {
      x: doc._source?.x ?? doc.x,
      y: doc._source?.y ?? doc.y,
      width: doc.width,
      height: doc.height
    };
    const origin = prior ?? destination;
    considerPoints(doc, [origin, destination], game.user.id);
  });

  Hooks.on("refreshToken", (token) => {
    if (!token?.document?.parent) return;
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
    considerPoints(token.document, [point], game.user.id, { emit: false });
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
    considerPoints(token, message.points ?? [message.origin, message.destination], message.userId, {
      emit: false
    });
  });
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

function movementPoints(tokenDoc, movement) {
  const points = [];
  const seen = new Set();
  const add = (raw) => {
    const point = normalizeTokenPoint(tokenDoc, raw);
    if (!point) return;
    const key = `${point.x}:${point.y}:${point.width}:${point.height}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push(point);
  };

  add(movement?.origin);
  for (const waypoint of movement?.passed?.waypoints ?? []) add(waypoint);
  for (const waypoint of movement?.pending?.waypoints ?? []) add(waypoint);
  add(movement?.destination);
  return points;
}

function handleMovement(doc, movement, userId) {
  const points = movementPoints(doc, movement);
  if (points.length < 1) return;
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

  for (const tile of tiles) {
    const key = occupancyKey(tokenDoc.id, tile.id);
    const here = { x: tokenDoc.x, y: tokenDoc.y, width: tokenDoc.width, height: tokenDoc.height };
    let inside = occupancy.has(key) ? occupancy.get(key) : tokenOverlapsTile(tokenDoc, here, tile);
    let entered = false;
    for (const point of normalized) {
      const now = tokenOverlapsTile(tokenDoc, point, tile);
      if (now && !inside) entered = true;
      inside = now;
    }
    occupancy.set(key, inside);
    if (!entered) continue;
    const config = getConfig(tile);
    if (!canTrigger(tokenDoc, config, userId)) continue;
    void playFromDocument(tile, { triggeringToken: tokenDoc });
  }
}
