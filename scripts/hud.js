import { isPlayerOwnedToken } from "./constants.js";
import { openDialogueConfig } from "./config-app.js";
import { playFromToken } from "./play.js";

function asElement(html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return html?.element ?? null;
}

function addHudButton(root, { title, icon, onClick }) {
  const col = root.querySelector(".col.right") ?? root.querySelector(".col.left") ?? root;
  const btn = document.createElement("div");
  btn.className = "control-icon dialoguer-hud-btn";
  btn.title = title;
  btn.innerHTML = `<i class="${icon}"></i>`;
  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  col.appendChild(btn);
  return btn;
}

export function registerHud() {
  Hooks.on("renderTokenHUD", (hud, html) => {
    if (!game.user.isGM) return;
    const root = asElement(html);
    if (!root) return;
    const tokenDoc = hud.object?.document;
    if (!tokenDoc) return;

    addHudButton(root, {
      title: game.i18n.localize("DIALOGUER.HUD.Speak"),
      icon: "fa-solid fa-comment-dots",
      onClick: () => {
        const other = canvas.tokens.controlled.find((token) => {
          return token.id !== tokenDoc.id && isPlayerOwnedToken(token.document);
        });
        void playFromToken(tokenDoc, {
          triggeringToken: other?.document ?? tokenDoc,
          once: false,
          playerTokensOnly: false
        });
      }
    });

    addHudButton(root, {
      title: game.i18n.localize("DIALOGUER.HUD.Configure"),
      icon: "fa-solid fa-feather",
      onClick: () => {
        const actor = tokenDoc.actor;
        if (actor) openDialogueConfig(actor);
      }
    });
  });

  Hooks.on("renderTileHUD", (hud, html) => {
    if (!game.user.isGM) return;
    const root = asElement(html);
    if (!root) return;
    const tileDoc = hud.object?.document;
    if (!tileDoc) return;
    addHudButton(root, {
      title: game.i18n.localize("DIALOGUER.TileHUD.Configure"),
      icon: "fa-solid fa-comment-dots",
      onClick: () => openDialogueConfig(tileDoc)
    });
  });
}
