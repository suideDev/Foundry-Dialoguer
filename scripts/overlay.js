import { MODULE_ID, resolveTheme } from "./constants.js";
import { startHop, stopHop } from "./hop.js";

let current = null;

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function blip(hz) {
  if (!game.settings.get(MODULE_ID, "blip")) return;
  try {
    const ctx = game.audio?.context;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const volume = Number(game.settings.get(MODULE_ID, "blipVolume")) || 0.04;
    const pitch = Number.isFinite(hz) && hz > 0
      ? Number(hz)
      : Number(game.settings.get(MODULE_ID, "blipPitch")) || 980;
    const jitter = Math.min(220, pitch * 0.18);
    osc.type = "square";
    osc.frequency.value = Math.max(50, pitch - jitter / 2 + Math.random() * jitter);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  } catch {
    // Audio context may be suspended until a user gesture.
  }
}

export function previewBlip(hz) {
  blip(hz);
}

function defaultTypingMs() {
  return Number(game.settings.get(MODULE_ID, "typingMs")) || 0;
}

export class DialogueOverlay {
  constructor(payload) {
    this.payload = payload;
    this.lines = payload.lines ?? [];
    this.index = 0;
    this.pageIndex = 0;
    this.pages = [];
    this.shown = "";
    this.full = "";
    this.typing = false;
    this.skip = false;
    this.closed = false;
    this.root = null;
    this._onKey = this.#onKey.bind(this);
    this._onClick = this.#onClick.bind(this);
  }

  async start() {
    if (!this.lines.length) {
      this.payload.onClose?.();
      return;
    }
    this.#mount();
    window.addEventListener("keydown", this._onKey, true);
    this.root.addEventListener("click", this._onClick);
    await this.#playLine(0);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.skip = true;
    this.typing = false;
    if ((this.payload.hop || this.payload.slide) && this.payload.speakerTokenId) stopHop(this.payload.speakerTokenId);
    window.removeEventListener("keydown", this._onKey, true);
    this.root?.remove();
    this.root = null;
    if (current === this) current = null;
    this.payload.onClose?.();
  }

  advance() {
    if (this.closed) return true;
    if (this.typing) {
      this.skip = true;
      return true;
    }
    if (this.pageIndex < this.pages.length - 1) {
      void this.#playPage(this.pageIndex + 1);
      return true;
    }
    if (this.index < this.lines.length - 1) {
      void this.#playLine(this.index + 1);
      return true;
    }
    this.close();
    return true;
  }

  #mount() {
    const root = document.createElement("div");
    const theme = resolveTheme(this.payload.theme);
    root.id = "dialoguer-overlay";
    root.dataset.theme = theme;
    root.className = `dialoguer-overlay theme-${theme}`;
    root.innerHTML = `
      <div class="dialoguer-stage">
        <div class="dialoguer-portrait-wrap">
          <img class="dialoguer-portrait" alt="" />
        </div>
        <div class="dialoguer-box">
          <div class="dialoguer-name"></div>
          <div class="dialoguer-text"></div>
          <div class="dialoguer-advance"></div>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    this.root = root;
    this.portraitEl = root.querySelector(".dialoguer-portrait");
    this.portraitWrap = root.querySelector(".dialoguer-portrait-wrap");
    this.nameEl = root.querySelector(".dialoguer-name");
    this.textEl = root.querySelector(".dialoguer-text");
    this.advanceEl = root.querySelector(".dialoguer-advance");
  }

  async #playLine(index) {
    if (this.closed) return;
    this.index = index;
    this.pageIndex = 0;
    const line = this.lines[index];
    const portrait = line.portrait || this.payload.portrait;
    if (portrait) {
      this.portraitEl.src = portrait;
      this.portraitEl.style.display = "";
      this.portraitWrap.classList.remove("is-empty");
    } else {
      this.portraitEl.removeAttribute("src");
      this.portraitEl.style.display = "none";
      this.portraitWrap.classList.add("is-empty");
    }
    const name = this.payload.speakerName ?? "";
    const theme = resolveTheme(this.payload.theme);
    const star = theme === "classic" || theme === "terminal";
    this.nameEl.textContent = name ? (star ? `* ${name}` : name) : "";
    
    const text = line.text ?? "";
    this.pages = text.split(/\[page\]/i).map((page) => page.trim()).filter(Boolean);
    if (!this.pages.length) this.pages = [""];
    
    await this.#playPage(0);
  }

  async #playPage(pageIndex) {
    if (this.closed) return;
    this.pageIndex = pageIndex;
    this.advanceEl.classList.remove("is-ready");
    this.full = this.pages[pageIndex] ?? "";
    this.shown = "";
    this.textEl.textContent = "";
    this.skip = false;
    this.typing = true;

    if ((this.payload.hop || this.payload.slide) && this.payload.speakerTokenId) {
      startHop(this.payload.speakerTokenId, {
        hop: this.payload.hop,
        periodMs: this.payload.hopMs,
        durationMs: this.payload.hopDurationMs,
        slide: this.payload.slide,
        slidePx: this.payload.slidePx,
        slideMs: this.payload.slideMs
      });
    }

    const speed = this.payload.typingMs ?? defaultTypingMs();
    if (speed <= 0) {
      this.shown = this.full;
      this.textEl.textContent = this.shown;
    } else {
      for (let i = 0; i < this.full.length; i++) {
        if (this.closed) return;
        if (this.skip) {
          this.shown = this.full;
          this.textEl.textContent = this.shown;
          break;
        }
        const ch = this.full[i];
        this.shown += ch;
        this.textEl.textContent = this.shown;
        if (ch.trim()) blip(this.payload.blipPitch);
        await sleep(speed);
      }
    }

    this.typing = false;
    this.skip = false;
    if (!this.closed) this.advanceEl.classList.add("is-ready");
  }

  #onKey(event) {
    if (event.repeat) return;
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.code === "Space" || event.code === "Enter" || event.code === "KeyZ" || event.code === "KeyX") {
      event.preventDefault();
      event.stopPropagation();
      this.advance();
    }
  }

  #onClick(event) {
    event.preventDefault();
    this.advance();
  }
}

export function getActiveOverlay() {
  return current;
}

export async function showOverlay(payload) {
  if (current) {
    current.payload.onClose = null;
    current.close();
  }
  const overlay = new DialogueOverlay(payload);
  current = overlay;
  await overlay.start();
  return overlay;
}
