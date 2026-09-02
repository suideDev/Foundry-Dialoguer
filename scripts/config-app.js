import { AUDIENCE, DEFAULT_CONFIG, MODULE_ID, audienceChoices, getConfig, setConfig, themeChoices, displayChoices } from "./constants.js";
import { clearFired, play } from "./play.js";
import { previewBlip } from "./overlay.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DialogueConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "dialoguer-config",
    classes: ["dialoguer-config", "standard-form"],
    tag: "form",
    window: {
      title: "DIALOGUER.ConfigTitle",
      icon: "fa-solid fa-comment-dots",
      resizable: true
    },
    position: { width: 560, height: 640 },
    form: {
      handler: DialogueConfigApp.#onSubmit,
      closeOnSubmit: true
    },
    actions: {
      pickPortrait: DialogueConfigApp.#onPickPortrait,
      useSelected: DialogueConfigApp.#onUseSelected,
      resetHistory: DialogueConfigApp.#onResetHistory,
      test: DialogueConfigApp.#onTest
    }
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/config.hbs` }
  };

  constructor(document, options = {}) {
    super(options);
    this.document = document;
  }

  get isTile() {
    return this.document.documentName === "Tile";
  }

  get isActor() {
    return this.document.documentName === "Actor";
  }

  async _prepareContext() {
    const config = getConfig(this.document);
    if (this.isActor && !config.script) {
      config.audience = config.audience || AUDIENCE.gmAndTriggering;
    }
    const pitch = Number(config.blipPitch);
    return {
      config,
      showEnabled: this.isTile,
      showSpeaker: this.isTile,
      showPlayerTokensOnly: this.isTile,
      audiences: audienceChoices(),
      themes: themeChoices(),
      displays: displayChoices(),
      blipPitchSlider: Number.isFinite(pitch) && pitch > 0 ? pitch : 980
    };
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender?.(context, options);
    const maxH = Math.max(420, Math.floor(window.innerHeight * 0.85));
    const height = Math.min(this.position.height || 640, maxH);
    this.setPosition({ height });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const drop = this.element.querySelector("[data-drop='speaker']");
    drop?.addEventListener("dragover", (event) => event.preventDefault());
    drop?.addEventListener("drop", (event) => this.#onDropSpeaker(event));
    this.#bindPitchControls();
  }

  static async #onSubmit(_event, _form, formData) {
    const app = this;
    const data = formData.object;
    const config = foundry.utils.mergeObject(foundry.utils.deepClone(DEFAULT_CONFIG), {
      enabled: Boolean(data.enabled),
      speakerUuid: data.speakerUuid ?? "",
      portrait: data.portrait ?? "",
      script: data.script ?? "",
      audience: data.audience ?? AUDIENCE.gmAndTriggering,
      once: Boolean(data.once),
      hop: Boolean(data.hop),
      playerTokensOnly: Boolean(data.playerTokensOnly),
      typingMs: optionalNumber(data.typingMs),
      blipPitch: optionalNumber(data.blipPitch),
      theme: data.theme || "classic",
      display: data.display || "box",
      ambientSize: optionalNumber(data.ambientSize),
      hopMs: optionalNumber(data.hopMs),
      hopDurationMs: optionalNumber(data.hopDurationMs)
    }, { inplace: false });
    if (!app.isTile) {
      config.enabled = true;
      config.playerTokensOnly = false;
    }
    await setConfig(app.document, config);
    ui.notifications.info(game.i18n.localize("DIALOGUER.Saved"));
  }

  static async #onPickPortrait() {
    const input = this.element.querySelector('input[name="portrait"]');
    const Picker = foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
    new Picker({
      type: "image",
      current: input?.value ?? "",
      callback: (path) => {
        if (input) input.value = path;
      }
    }).render({ force: true });
  }

  static #onUseSelected() {
    const token = canvas.tokens?.controlled[0];
    if (!token) return;
    const input = this.element.querySelector('input[name="speakerUuid"]');
    if (input) input.value = token.document.uuid;
  }

  static async #onResetHistory() {
    await clearFired(this.document);
    ui.notifications.info(game.i18n.localize("DIALOGUER.HistoryCleared"));
  }

  static async #onTest() {
    const config = DialogueConfigApp.#readForm(this);
    config.once = false;
    config.playerTokensOnly = false;
    const selected = canvas.tokens?.controlled[0]?.document ?? null;
    let speaker = null;
    if (config.speakerUuid) {
      try {
        speaker = await fromUuid(config.speakerUuid);
      } catch {
        speaker = null;
      }
    }
    if (this.isActor) {
      speaker = canvas.tokens?.placeables.find((token) => token.actor?.id === this.document.id)?.document
        ?? selected;
      await play({
        source: this.document,
        config,
        speaker,
        triggeringToken: selected ?? speaker,
        scene: canvas.scene
      });
      return;
    }
    await play({
      source: this.document,
      config,
      speaker: speaker?.documentName === "Token" ? speaker : null,
      triggeringToken: selected,
      scene: canvas.scene
    });
  }

  static #readForm(app) {
    const form = app.element;
    const Ctor = foundry.applications?.ux?.FormDataExtended ?? globalThis.FormDataExtended;
    const data = Ctor ? new Ctor(form).object : Object.fromEntries(new FormData(form).entries());
    return {
      enabled: Boolean(data.enabled),
      speakerUuid: data.speakerUuid ?? "",
      portrait: data.portrait ?? "",
      script: data.script ?? "",
      audience: data.audience ?? AUDIENCE.gmAndTriggering,
      once: Boolean(data.once),
      hop: Boolean(data.hop),
      playerTokensOnly: Boolean(data.playerTokensOnly),
      typingMs: optionalNumber(data.typingMs),
      blipPitch: optionalNumber(data.blipPitch),
      theme: data.theme || "classic",
      display: data.display || "box",
      ambientSize: optionalNumber(data.ambientSize),
      hopMs: optionalNumber(data.hopMs),
      hopDurationMs: optionalNumber(data.hopDurationMs)
    };
  }

  #bindPitchControls() {
    const slider = this.element.querySelector("[data-blip-pitch-slider]");
    const number = this.element.querySelector('input[name="blipPitch"]');
    if (!slider || !number || slider.dataset.bound) return;
    slider.dataset.bound = "1";
    let lastPreview = 0;
    const preview = (hz) => {
      const now = performance.now();
      if (now - lastPreview < 70) return;
      lastPreview = now;
      previewBlip(hz);
    };
    slider.addEventListener("input", () => {
      number.value = slider.value;
      preview(Number(slider.value));
    });
    number.addEventListener("input", () => {
      const hz = optionalNumber(number.value);
      slider.value = String(hz && hz > 0 ? hz : 980);
    });
  }

  #onDropSpeaker(event) {
    event.preventDefault();
    const raw = event.dataTransfer?.getData("text/plain");
    if (!raw) return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    const uuid = data.uuid;
    if (!uuid) return;
    const input = this.element.querySelector('input[name="speakerUuid"]');
    if (input) input.value = uuid;
  }
}

export function openDialogueConfig(document) {
  if (!document) return;
  new DialogueConfigApp(document).render({ force: true });
}

function optionalNumber(raw) {
  if (raw === "" || raw === undefined || raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
