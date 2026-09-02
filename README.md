# Dialoguer

Undertale-style dialogue for Foundry VTT v13/v14. A player walks onto a tile or region. Their client gets a portrait and a typed text box. The NPC token hops while the line is appearing.

The overlay is sent to the triggering player instead of everyone.

## Install

The Foundry module id is `dialoguer`. The install folder must be named `dialoguer`.

### The Forge

1. Open your Foundry setup on The Forge.
2. **Add-on Modules** → **Install Module**.
3. Paste this Manifest URL and install:

```
https://github.com/suideDev/Foundry-Dialoguer/releases/latest/download/module.json
```

4. Enable **Dialoguer** in the world.

Do not install by cloning this GitHub repo as `Foundry-Dialoguer`. Foundry will ignore a folder whose name does not match `dialoguer`.

### Local Foundry

```
mklink /D "%LOCALAPPDATA%\FoundryVTT\Data\modules\dialoguer" "G:\GithubStuff\Foundry-Dialoguer"
```

Adjust the Foundry Data path if yours is not the default.

## Setup

One pad, one NPC, one player.

1. Put the NPC token on the map. Use the art you want in the overlay as the token image, or set a portrait override later.
2. Draw a tile over the trigger area. Hide the tile so players do not see a square.
3. Open the tile HUD (click the tile) and press the comment icon.
4. Check **Play dialogue when a token enters this tile**.
5. Drop the NPC token into **Speaker**, or leave it blank to use the nearest token.
6. Write the dialogue. A blank line starts the next box:

```
Hello.

Stay determined.
```

7. Set **Who sees it** to **GM and triggering player**.
8. Leave **Once per token** and **Hop** on.
9. Save. Click **Test** while you have the NPC (or the player token) selected.

Walk a player-owned token onto the tile. Space, Enter, Z, X, or click advances. Escape closes.

Each player only sees the overlay if they are the one who stepped on that pad.

## Regions

1. Draw a Scene Region over the pad.
2. Add behavior **Play Dialogue**.
3. Fill in the same fields. Default event is **Token moves in**, so it will not fire just because a token is already standing there when the scene loads.

## Actor dialogue

Click an NPC token. The HUD has two Dialoguer buttons:

- **Speak** plays that actor's stored lines immediately.
- **Configure dialogue** edits the actor.

If a tile or region has a speaker but an empty script, Dialoguer uses the speaker actor's stored lines. Write common chatter on the actor. Write pad-specific lines on the tile.

## Macro / API

```js
game.dialoguer.play({
  speaker: canvas.tokens.controlled[0].document,
  config: {
    script: "Hello.\n\nStay determined.",
    hop: true,
    audience: "gmAndTriggering"
  },
  triggeringToken: canvas.tokens.controlled[0].document
});
```

```js
game.dialoguer.playFromToken(tokenDocument);
game.dialoguer.openConfig(tileDocument);
game.dialoguer.clearFired(tileDocument);
```

## Audience

| Who sees it | What happens |
|---|---|
| Triggering player | Token owners only (usually the one player) |
| GM and triggering player | Default. You see what they see. |
| Everyone viewing this scene | Everyone looking at this map |
| Everyone connected | Broadcast |

World setting **GM always sees dialogue** adds you even when audience is set to triggering player only.

## Controls

- Click / Space / Enter / Z / X: skip typing, then next box, then close
- Escape: close
- Clicking while it types dumps the rest of the line
- Text box theme on each tile, actor, or region
- Ambient mode floats the line over the speaker instead of opening the box

Hop is visual only. It does not move the token document.

## Settings

- Default typing speed
- Hop height
- Default hop speed
- Default ambient text size
- Typing blip on/off, volume, and default pitch (client)
- GM always sees dialogue
