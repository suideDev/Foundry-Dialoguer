import { MODULE_ID } from "./constants.js";
import { registerSocket, play, playFromDocument, playFromToken, clearFired } from "./play.js";
import { closeAmbient } from "./ambient.js";
import { stopAllHops } from "./hop.js";
import { openDialogueConfig } from "./config-app.js";
import { enhanceRegionBehaviorSheet, registerRegionBehavior } from "./region-behavior.js";
import { registerTileTriggers } from "./tile-trigger.js";
import { registerHud } from "./hud.js";
import { registerMatt } from "./matt.js";

Hooks.once("init", () => {
  registerRegionBehavior();
  registerSettings();
  registerMatt();
});

Hooks.once("ready", () => {
  registerSocket();
  registerTileTriggers();
  registerHud();

  game.dialoguer = {
    play,
    playFromDocument,
    playFromToken,
    openConfig: openDialogueConfig,
    clearFired
  };

  Hooks.on("canvasTearDown", () => {
    closeAmbient(true);
    stopAllHops();
  });
  Hooks.on("renderRegionBehaviorConfig", (app, html) => enhanceRegionBehaviorSheet(app, html));
});

function registerSettings() {
  game.settings.register(MODULE_ID, "typingMs", {
    name: "DIALOGUER.Settings.TypingMs",
    hint: "DIALOGUER.Settings.TypingMsHint",
    scope: "world",
    config: true,
    type: Number,
    default: 28
  });

  game.settings.register(MODULE_ID, "hopHeight", {
    name: "DIALOGUER.Settings.HopHeight",
    scope: "world",
    config: true,
    type: Number,
    default: 16
  });

  game.settings.register(MODULE_ID, "hopMs", {
    name: "DIALOGUER.Settings.HopMs",
    hint: "DIALOGUER.Settings.HopMsHint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 40, max: 600, step: 10 },
    default: 160
  });

  game.settings.register(MODULE_ID, "hopDurationMs", {
    name: "DIALOGUER.Settings.HopDurationMs",
    hint: "DIALOGUER.Settings.HopDurationMsHint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 0, max: 20000, step: 50 },
    default: 0
  });

  game.settings.register(MODULE_ID, "ambientSize", {
    name: "DIALOGUER.Settings.AmbientSize",
    hint: "DIALOGUER.Settings.AmbientSizeHint",
    scope: "world",
    config: true,
    type: Number,
    range: { min: 12, max: 72, step: 1 },
    default: 28
  });

  game.settings.register(MODULE_ID, "blip", {
    name: "DIALOGUER.Settings.Blip",
    hint: "DIALOGUER.Settings.BlipHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "blipVolume", {
    name: "DIALOGUER.Settings.BlipVolume",
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 0.2, step: 0.01 },
    default: 0.04
  });

  game.settings.register(MODULE_ID, "blipPitch", {
    name: "DIALOGUER.Settings.BlipPitch",
    hint: "DIALOGUER.Settings.BlipPitchHint",
    scope: "client",
    config: true,
    type: Number,
    range: { min: 50, max: 2000, step: 10 },
    default: 980
  });

  game.settings.register(MODULE_ID, "whisperChat", {
    name: "DIALOGUER.Settings.WhisperChat",
    hint: "DIALOGUER.Settings.WhisperChatHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "gmAlwaysSees", {
    name: "DIALOGUER.Settings.GmAlwaysSees",
    hint: "DIALOGUER.Settings.GmAlwaysSeesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}
