import { MODULE_ID } from "./constants.js";
import { playFromDocument } from "./play.js";

export function registerMatt() {
  Hooks.on("setupTileActions", (app) => {
    if (!app?.registerTileAction) return;
    app.registerTileGroup?.(MODULE_ID, game.i18n.localize("DIALOGUER.MATT.Group"));
    app.registerTileAction(MODULE_ID, "play", {
      name: "DIALOGUER.MATT.Play",
      group: MODULE_ID,
      ctrls: [
        {
          id: "script",
          name: "DIALOGUER.Script",
          type: "text",
          required: false
        }
      ],
      fn: async (args = {}) => {
        const { tokens = [], tile, action } = args;
        const tileDoc = tile?.document ?? tile;
        const tokenDoc = tokens[0]?.document ?? tokens[0] ?? null;
        const extra = {};
        if (action?.data?.script) extra.script = action.data.script;
        await playFromDocument(tileDoc, { triggeringToken: tokenDoc, extra });
        return {};
      },
      content: async (_trigger, action) => {
        const label = game.i18n.localize("DIALOGUER.MATT.PlayContent");
        const preview = action?.data?.script
          ? ` "${String(action.data.script).slice(0, 24)}"`
          : "";
        return `<span class="action-style">${label}</span>${preview}`;
      }
    });
  });
}
