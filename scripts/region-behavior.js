import { AUDIENCE, DISPLAY, REGION_TYPE, THEMES, isAuthority } from "./constants.js";
import { play } from "./play.js";

const { RegionBehaviorType } = foundry.data.regionBehaviors;
const fields = foundry.data.fields;

export class DialogueRegionBehaviorType extends RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["DIALOGUER.BEHAVIOR"];

  static defineSchema() {
    return {
      events: this._createEventsField({
        events: [CONST.REGION_EVENTS.TOKEN_MOVE_IN, CONST.REGION_EVENTS.TOKEN_ENTER],
        initial: [CONST.REGION_EVENTS.TOKEN_MOVE_IN]
      }),
      speakerUuid: new fields.StringField({ required: true, blank: true, initial: "" }),
      portrait: new fields.FilePathField({
        categories: ["IMAGE"],
        required: false,
        nullable: true,
        initial: null
      }),
      script: new fields.StringField({ required: true, blank: true, initial: "" }),
      audience: new fields.StringField({
        required: true,
        initial: AUDIENCE.gmAndTriggering,
        choices: {
          triggering: "DIALOGUER.AudienceTriggering",
          gmAndTriggering: "DIALOGUER.AudienceGmAndTriggering",
          scene: "DIALOGUER.AudienceScene",
          all: "DIALOGUER.AudienceAll"
        }
      }),
      once: new fields.BooleanField({ initial: true }),
      hop: new fields.BooleanField({ initial: true }),
      playerTokensOnly: new fields.BooleanField({ initial: true }),
      typingMs: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        min: 0,
        max: 200,
        initial: null
      }),
      blipPitch: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        min: 50,
        max: 2000,
        initial: null
      }),
      theme: new fields.StringField({
        required: true,
        initial: "classic",
        choices: THEMES
      }),
      display: new fields.StringField({
        required: true,
        initial: DISPLAY.box,
        choices: {
          box: "DIALOGUER.DisplayBox",
          ambient: "DIALOGUER.DisplayAmbient"
        }
      }),
      ambientSize: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        min: 12,
        max: 72,
        initial: null
      }),
      hopMs: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        min: 40,
        max: 600,
        initial: null
      }),
      hopDurationMs: new fields.NumberField({
        required: false,
        nullable: true,
        integer: true,
        min: 0,
        max: 20000,
        initial: null
      })
    };
  }

  static events = {
    [CONST.REGION_EVENTS.TOKEN_MOVE_IN]: DialogueRegionBehaviorType.#onTokenEnter,
    [CONST.REGION_EVENTS.TOKEN_ENTER]: DialogueRegionBehaviorType.#onTokenEnter
  };

  static async #onTokenEnter(event) {
    if (!isAuthority()) return;
    if (!this.events.has(event.name)) return;
    const token = event.data?.token;
    if (!token) return;
    await play({
      source: this.behavior,
      config: {
        speakerUuid: this.speakerUuid,
        portrait: this.portrait ?? "",
        script: this.script,
        audience: this.audience,
        once: this.once,
        hop: this.hop,
        playerTokensOnly: this.playerTokensOnly,
        typingMs: this.typingMs,
        blipPitch: this.blipPitch,
        theme: this.theme,
        display: this.display,
        ambientSize: this.ambientSize,
        hopMs: this.hopMs,
        hopDurationMs: this.hopDurationMs
      },
      triggeringToken: token,
      scene: this.scene
    });
  }
}

export function registerRegionBehavior() {
  CONFIG.RegionBehavior.dataModels[REGION_TYPE] = DialogueRegionBehaviorType;
  CONFIG.RegionBehavior.typeIcons[REGION_TYPE] = "fa-solid fa-comment-dots";
  if (CONFIG.RegionBehavior.typeLabels) {
    CONFIG.RegionBehavior.typeLabels[REGION_TYPE] = "DIALOGUER.RegionBehavior";
  }
}

function asElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return html?.element ?? null;
}

export function enhanceRegionBehaviorSheet(app, html) {
  const type = app.document?.type;
  if (type !== REGION_TYPE) return;
  const root = asElement(html);
  if (!root) return;
  const input = root.querySelector('[name="system.script"]');
  if (!input || input.tagName === "TEXTAREA") return;
  const ta = document.createElement("textarea");
  ta.name = input.name;
  ta.value = input.value;
  ta.rows = 8;
  ta.style.minHeight = "10rem";
  input.replaceWith(ta);
}
