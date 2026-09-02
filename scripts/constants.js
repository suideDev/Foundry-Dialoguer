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
  typingMs: null,
  blipPitch: null,
  theme: "classic",
  display: "box",
  ambientSize: null,
  hopMs: null,
  hopDurationMs: null
};

export const DISPLAY = {
  box: "box",
  ambient: "ambient"
};

export function displayChoices() {
  return {
    [DISPLAY.box]: "DIALOGUER.DisplayBox",
    [DISPLAY.ambient]: "DIALOGUER.DisplayAmbient"
  };
}

export const THEMES = {
  classic: "DIALOGUER.ThemeClassic",
  parchment: "DIALOGUER.ThemeParchment",
  arcane: "DIALOGUER.ThemeArcane",
  stone: "DIALOGUER.ThemeStone",
  whisper: "DIALOGUER.ThemeWhisper",
  terminal: "DIALOGUER.ThemeTerminal",
  starweave: "DIALOGUER.ThemeStarweave",
  brimstone: "DIALOGUER.ThemeBrimstone",
  umbral: "DIALOGUER.ThemeUmbral",
  fen: "DIALOGUER.ThemeFen"
};

export function audienceChoices() {
  return {
    [AUDIENCE.triggering]: "DIALOGUER.AudienceTriggering",
    [AUDIENCE.gmAndTriggering]: "DIALOGUER.AudienceGmAndTriggering",
    [AUDIENCE.scene]: "DIALOGUER.AudienceScene",
    [AUDIENCE.all]: "DIALOGUER.AudienceAll"
  };
}

export function themeChoices() {
  return { ...THEMES };
}

export function resolveTheme(id) {
  return THEMES[id] ? id : "classic";
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
  if (!tokenDoc) return false;
  if (tokenDoc.hasPlayerOwner || tokenDoc.actor?.hasPlayerOwner) return true;
  const players = game.users.filter((user) => !user.isGM);
  if (!players.length) return true;
  return false;
}

export function tokenCenter(tokenDoc, point = null) {
  const size = tokenDoc.parent?.grid?.size ?? 100;
  const x = point?.x ?? tokenDoc.x;
  const y = point?.y ?? tokenDoc.y;
  const width = point?.width ?? tokenDoc.width;
  const height = point?.height ?? tokenDoc.height;
  return {
    x: x + (width * size) / 2,
    y: y + (height * size) / 2
  };
}

export function isAuthority() {
  const gm = game.users.activeGM;
  return gm ? gm.id === game.user.id : game.user.isGM;
}

export function tilePixelRect(tileDoc) {
  const bounds = tileDoc.object?.bounds;
  if (bounds && Number.isFinite(bounds.width) && bounds.width > 0) {
    return { x: bounds.x, y: bounds.y, w: Math.abs(bounds.width), h: Math.abs(bounds.height) };
  }
  return {
    x: tileDoc.x,
    y: tileDoc.y,
    w: Math.abs(tileDoc.width),
    h: Math.abs(tileDoc.height)
  };
}

export function normalizeTokenPoint(tokenDoc, point) {
  if (!point) return null;
  const x = Number(point.x);
  const y = Number(point.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const width = Number(point.width);
  const height = Number(point.height);
  return {
    x,
    y,
    width: width > 0 ? width : tokenDoc.width,
    height: height > 0 ? height : tokenDoc.height
  };
}

export function tokenOverlapsTile(tokenDoc, point, tileDoc) {
  const size = tokenDoc.parent?.grid?.size ?? 100;
  const normalized = normalizeTokenPoint(tokenDoc, point) ?? {
    x: tokenDoc.x,
    y: tokenDoc.y,
    width: tokenDoc.width,
    height: tokenDoc.height
  };
  const width = normalized.width * size;
  const height = normalized.height * size;
  const tile = tilePixelRect(tileDoc);
  return (
    normalized.x < tile.x + tile.w
    && normalized.x + width > tile.x
    && normalized.y < tile.y + tile.h
    && normalized.y + height > tile.y
  );
}
