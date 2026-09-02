export const MODULE_ID = "dialoguer";
export const SOCKET_EVENT = `module.${MODULE_ID}`;
export const REGION_TYPE = `${MODULE_ID}.dialogue`;
export const FLAG_CONFIG = "config";
export const FLAG_FIRED = "fired";

export const AUDIENCE = {
  triggering: "triggering",
  gmAndTriggering: "gmAndTriggering",
  scene: "scene",
  all: "all"
};

export const DEFAULT_CONFIG = {
  enabled: false,
  speakerUuid: "",
  portrait: "",
  script: "",
  audience: AUDIENCE.gmAndTriggering,
  once: true,
  hop: true,
  playerTokensOnly: true,
  typingMs: null
};

export function audienceChoices() {
  return {
    [AUDIENCE.triggering]: "DIALOGUER.AudienceTriggering",
    [AUDIENCE.gmAndTriggering]: "DIALOGUER.AudienceGmAndTriggering",
    [AUDIENCE.scene]: "DIALOGUER.AudienceScene",
    [AUDIENCE.all]: "DIALOGUER.AudienceAll"
  };
}

export function getConfig(doc) {
  const stored = doc.getFlag(MODULE_ID, FLAG_CONFIG) ?? {};
  return foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_CONFIG), stored, { inplace: false });
}

export async function setConfig(doc, config) {
  return doc.setFlag(MODULE_ID, FLAG_CONFIG, config);
}

export function parseLines(script) {
  return String(script ?? "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);
}

export function isPlayerOwnedToken(tokenDoc) {
  const actor = tokenDoc.actor;
  if (!actor) return false;
  return game.users.some((user) => !user.isGM && actor.testUserPermission(user, "OWNER"));
}

export function isAuthority() {
  const gm = game.users.activeGM;
  return gm ? gm.id === game.user.id : game.user.isGM;
}

export function tokenCenter(tokenDoc) {
  const object = tokenDoc.object;
  if (object?.center) return object.center;
  const size = tokenDoc.parent?.grid?.size ?? 100;
  return {
    x: tokenDoc.x + (tokenDoc.width * size) / 2,
    y: tokenDoc.y + (tokenDoc.height * size) / 2
  };
}

export function pointInTile(point, tileDoc) {
  const x1 = tileDoc.x;
  const y1 = tileDoc.y;
  const x2 = x1 + Math.abs(tileDoc.width);
  const y2 = y1 + Math.abs(tileDoc.height);
  return point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2;
}
