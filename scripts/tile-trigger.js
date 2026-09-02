import { SOCKET_EVENT, getConfig, isAuthority, isPlayerOwnedToken, tokenOverlapsTile } from "./constants.js";
import { playFromDocument } from "./play.js";

const recent = new Map();

export function registerTileTriggers() {
  Hooks.on("preMoveToken", (doc, movement) => {
    const origin = movement?.origin;
    const destination = movement?.destination;
    if (!origin || !destination) return;
    handleMovement(doc, origin, destination, game.user.id);
  });

  Hooks.on("moveToken", (doc, movement, _operation, user) => {
    const origin = movement?.origin;
    const destination = movement?.destination;
    if (!origin || !destination) return;
    const userId = typeof user === "string" ? user : user?.id;
    handleMovement(doc, origin, destination, userId);
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
    if (!prior) return;
    const destination = {
      x: doc._source?.x ?? doc.x,
      y: doc._source?.y ?? doc.y,
      width: doc.width,
      height: doc.height
    };
    handleMovement(doc, prior, destination, game.user.id);
  });

  game.socket.on(SOCKET_EVENT, (message) => {
    if (message?.action !== "tileEnter") return;
    if (!isAuthority()) return;
    const scene = game.scenes.get(message.sceneId);
    const token = scene?.tokens.get(message.tokenId);
    if (!token) return;
    void considerTileEntry(token, message.origin, message.destination, message.userId);
  });
}

function handleMovement(doc, origin, destination, userId) {
  if (isAuthority()) {
    void considerTileEntry(doc, origin, destination, userId);
    return;
  }
  if (userId !== game.user.id) return;
  game.socket.emit(SOCKET_EVENT, {
    action: "tileEnter",
    sceneId: doc.parent?.id,
    tokenId: doc.id,
    origin,
    destination,
    userId
  });
}

function canTrigger(tokenDoc, config, userId) {
  if (!config.playerTokensOnly) return true;
  if (isPlayerOwnedToken(tokenDoc)) return true;
  const mover = game.users.get(userId);
  return Boolean(mover && !mover.isGM);
}

async function considerTileEntry(tokenDoc, origin, destination, userId) {
  const scene = tokenDoc.parent;
  if (!scene) return;

  const tiles = scene.tiles.filter((tile) => getConfig(tile).enabled);

  for (const tile of tiles) {
    const insideNow = tokenOverlapsTile(tokenDoc, destination, tile);
    const insideWas = tokenOverlapsTile(tokenDoc, origin, tile);
    if (!insideNow || insideWas) continue;
    const config = getConfig(tile);
    if (!canTrigger(tokenDoc, config, userId)) continue;
    const key = `${tokenDoc.id}:${tile.id}`;
    const last = recent.get(key) ?? 0;
    if (Date.now() - last < 2000) continue;
    recent.set(key, Date.now());
    await playFromDocument(tile, { triggeringToken: tokenDoc });
  }
}
