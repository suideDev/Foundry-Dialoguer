import {
  AUDIENCE,
  DEFAULT_CONFIG,
  FLAG_FIRED,
  MODULE_ID,
  SOCKET_EVENT,
  getConfig,
  isAuthority,
  isPlayerOwnedToken,
  parseLines,
  tokenCenter
} from "./constants.js";
import { showOverlay, getActiveOverlay } from "./overlay.js";
import { stopAllHops } from "./hop.js";

const queue = [];
let playing = false;

export function registerSocket() {
  game.socket.on(SOCKET_EVENT, (message) => {
    if (!message) return;
    if (Array.isArray(message.userIds) && !message.userIds.includes(game.user.id)) return;
    if (message.action === "play") void receivePlay(message.payload);
    if (message.action === "stop") stopLocal();
  });
}

function stopLocal() {
  queue.length = 0;
  playing = false;
  const overlay = getActiveOverlay();
  if (overlay) {
    overlay.payload.onClose = null;
    overlay.close();
  } else {
    stopAllHops();
  }
}

async function receivePlay(payload) {
  if (playing) {
    queue.push(payload);
    return;
  }
  playing = true;
  try {
    await showOverlay({
      ...payload,
      onClose: () => {
        playing = false;
        const next = queue.shift();
        if (next) void receivePlay(next);
      }
    });
  } catch (err) {
    playing = false;
    console.error(`${MODULE_ID} | overlay failed`, err);
  }
}

function ownersOf(tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor) return [];
  return game.users.filter((user) => actor.testUserPermission(user, "OWNER"));
}

export function resolveAudience(audience, { triggeringToken, scene } = {}) {
  const active = game.users.filter((user) => user.active);
  let ids;
  switch (audience) {
    case AUDIENCE.triggering:
      ids = ownersOf(triggeringToken).filter((user) => !user.isGM).map((user) => user.id);
      if (!ids.length) ids = ownersOf(triggeringToken).map((user) => user.id);
      break;
    case AUDIENCE.scene:
      ids = active.filter((user) => user.viewedScene === scene?.id).map((user) => user.id);
      break;
    case AUDIENCE.all:
      ids = active.map((user) => user.id);
      break;
    case AUDIENCE.gmAndTriggering:
    default:
      ids = [
        ...active.filter((user) => user.isGM).map((user) => user.id),
        ...ownersOf(triggeringToken).map((user) => user.id)
      ];
      break;
  }
  if (game.settings.get(MODULE_ID, "gmAlwaysSees")) {
    ids.push(...active.filter((user) => user.isGM).map((user) => user.id));
  }
  return [...new Set(ids.filter(Boolean))];
}

function hasFired(source, tokenId) {
  const fired = source.getFlag(MODULE_ID, FLAG_FIRED) ?? {};
  return Boolean(fired[tokenId]);
}

export async function markFired(source, tokenId) {
  if (!source || !tokenId) return;
  const fired = foundry.utils.duplicate(source.getFlag(MODULE_ID, FLAG_FIRED) ?? {});
  fired[tokenId] = Date.now();
  await source.setFlag(MODULE_ID, FLAG_FIRED, fired);
}

export async function clearFired(source) {
  await source.unsetFlag(MODULE_ID, FLAG_FIRED);
}

async function fromUuidSafe(uuid) {
  if (!uuid) return null;
  try {
    return await fromUuid(uuid);
  } catch {
    return null;
  }
}

function tokensOnScene(scene) {
  return scene?.tokens?.contents ?? [];
}

function nearestToken(origin, scene, { excludeId } = {}) {
  const center = origin ? tokenCenter(origin) : { x: origin?.x ?? 0, y: origin?.y ?? 0 };
  let best = null;
  let bestDist = Infinity;
  for (const token of tokensOnScene(scene)) {
    if (token.id === excludeId) continue;
    const c = tokenCenter(token);
    const dist = Math.hypot(c.x - center.x, c.y - center.y);
    if (dist < bestDist) {
      best = token;
      bestDist = dist;
    }
  }
  return best;
}

export async function resolveSpeaker({ speakerUuid, triggeringToken, scene }) {
  const doc = await fromUuidSafe(speakerUuid);
  if (doc?.documentName === "Token") return doc;
  if (doc?.documentName === "Actor") {
    const match = tokensOnScene(scene).filter((token) => token.actorId === doc.id);
    if (!match.length) return null;
    if (match.length === 1 || !triggeringToken) return match[0];
    const origin = tokenCenter(triggeringToken);
    return match.slice().sort((a, b) => {
      const ac = tokenCenter(a);
      const bc = tokenCenter(b);
      return Math.hypot(ac.x - origin.x, ac.y - origin.y) - Math.hypot(bc.x - origin.x, bc.y - origin.y);
    })[0];
  }
  if (triggeringToken) return nearestToken(triggeringToken, scene, { excludeId: triggeringToken.id });
  return canvas.tokens?.controlled[0]?.document ?? null;
}

function portraitFor(speaker, override) {
  if (override) return override;
  return speaker?.texture?.src || speaker?.actor?.img || "";
}

function typingSpeed(config) {
  if (config.typingMs === 0) return 0;
  if (Number.isFinite(config.typingMs) && config.typingMs !== null && config.typingMs !== "") {
    return Number(config.typingMs);
  }
  return Number(game.settings.get(MODULE_ID, "typingMs"));
}

function blipPitch(config) {
  if (Number.isFinite(config.blipPitch) && config.blipPitch > 0) return Number(config.blipPitch);
  return Number(game.settings.get(MODULE_ID, "blipPitch")) || 980;
}

export async function play({
  source = null,
  config = {},
  triggeringToken = null,
  scene = triggeringToken?.parent ?? canvas.scene,
  speaker = null,
  lines = null,
  userIds = null
} = {}) {
  const merged = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_CONFIG), config, { inplace: false });
  if (merged.playerTokensOnly && triggeringToken && !isPlayerOwnedToken(triggeringToken)) {
    return false;
  }
  if (merged.once && source && triggeringToken && hasFired(source, triggeringToken.id)) return false;

  const speakerDoc = speaker ?? await resolveSpeaker({
    speakerUuid: merged.speakerUuid,
    triggeringToken,
    scene
  });
  if (!lines && !parseLines(merged.script).length && speakerDoc?.actor) {
    const actorCfg = getConfig(speakerDoc.actor);
    if (actorCfg.script) merged.script = actorCfg.script;
    if (!merged.portrait && actorCfg.portrait) merged.portrait = actorCfg.portrait;
    if (!Number.isFinite(merged.blipPitch) && Number.isFinite(actorCfg.blipPitch)) {
      merged.blipPitch = actorCfg.blipPitch;
    }
  }
  const parsed = lines ?? parseLines(merged.script).map((text) => ({ text, portrait: merged.portrait }));
  if (!parsed.length) {
    if (game.user.isGM) ui.notifications.warn(game.i18n.localize("DIALOGUER.NoLines"));
    return false;
  }

  const audienceIds = userIds ?? resolveAudience(merged.audience, { triggeringToken, scene });
  const payload = {
    speakerTokenId: speakerDoc?.id ?? null,
    speakerName: speakerDoc?.name ?? speakerDoc?.actor?.name ?? "",
    portrait: portraitFor(speakerDoc, merged.portrait),
    lines: parsed,
    hop: merged.hop !== false,
    typingMs: typingSpeed(merged),
    blipPitch: blipPitch(merged)
  };

  broadcastPlay(audienceIds, payload);
  void whisperToChat(payload, audienceIds, speakerDoc);
  if (merged.once && source && triggeringToken && isAuthority()) {
    void markFired(source, triggeringToken.id);
  }
  return true;
}

function escapeHTML(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function whisperToChat(payload, userIds, speakerDoc) {
  if (!game.settings.get(MODULE_ID, "whisperChat")) return;
  const recipients = [...new Set(userIds)].filter(Boolean);
  if (!recipients.length) return;
  const body = payload.lines.map((line) => `<p>${escapeHTML(line.text)}</p>`).join("");
  const token = speakerDoc?.object ?? canvas.tokens?.get(payload.speakerTokenId);
  const Chat = foundry.documents?.ChatMessage ?? globalThis.ChatMessage;
  const data = {
    content: `<div class="dialoguer-chat">${body}</div>`,
    speaker: Chat.getSpeaker?.({ token, actor: speakerDoc?.actor }) ?? {
      alias: payload.speakerName || game.i18n.localize("DIALOGUER.Title")
    },
    whisper: recipients,
    flavor: game.i18n.localize("DIALOGUER.ChatFlavor")
  };
  if (CONST.CHAT_MESSAGE_STYLES?.WHISPER != null) data.style = CONST.CHAT_MESSAGE_STYLES.WHISPER;
  try {
    await Chat.create(data);
  } catch (err) {
    console.error(`${MODULE_ID} | chat whisper failed`, err);
  }
}

export function broadcastPlay(userIds, payload) {
  const ids = [...new Set(userIds)];
  if (!ids.length) ids.push(game.user.id);
  if (ids.includes(game.user.id)) void receivePlay(payload);
  const others = ids.filter((id) => id !== game.user.id);
  if (others.length) game.socket.emit(SOCKET_EVENT, { action: "play", userIds: others, payload });
}

export async function playFromDocument(doc, { triggeringToken = null, extra = {} } = {}) {
  if (!doc) return false;
  let config;
  if (doc.documentName === "RegionBehavior") {
    config = {
      speakerUuid: doc.system.speakerUuid,
      portrait: doc.system.portrait ?? "",
      script: doc.system.script,
      audience: doc.system.audience,
      once: doc.system.once,
      hop: doc.system.hop,
      playerTokensOnly: doc.system.playerTokensOnly,
      typingMs: doc.system.typingMs,
      blipPitch: doc.system.blipPitch
    };
  } else {
    config = getConfig(doc);
  }
  return play({
    source: doc,
    config: foundry.utils.mergeObject(config, extra, { inplace: false }),
    triggeringToken,
    scene: triggeringToken?.parent ?? doc.parent?.parent ?? doc.parent ?? canvas.scene
  });
}

export async function playFromToken(tokenDoc, extra = {}) {
  const actor = tokenDoc.actor;
  const config = actor ? getConfig(actor) : {};
  config.speakerUuid = tokenDoc.uuid;
  const { triggeringToken, ...configExtra } = extra;
  return play({
    source: actor ?? tokenDoc,
    config: foundry.utils.mergeObject(config, configExtra, { inplace: false }),
    triggeringToken: triggeringToken ?? tokenDoc,
    speaker: tokenDoc,
    scene: tokenDoc.parent
  });
}
