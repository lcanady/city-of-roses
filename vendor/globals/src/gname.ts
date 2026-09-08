/**
 * +gname — gradient name. Set @moniker to a colorized version of your name
 * by blending across a list of color stops (HSL, shortest-arc hue).
 *
 *   +gname <color1> <color2> [<color3> ...]   Set gradient moniker.
 *   +gname                                    Show current moniker preview.
 *   +gname reset                              Clear moniker.
 *
 * Colors accepted (precedence: ANSI → CSS → xterm → hex):
 *   hr, hg, hy, hb, hm, hc, hw (bright ANSI)
 *   r,  g,  y,  b,  m,  c,  w  (dark ANSI)
 *   gold, crimson, skyblue, mediumseagreen, ... (CSS named, 147)
 *   DodgerBlue1, Salmon1, Grey50, ...           (xterm named, ~240)
 *   #ff5500 / ff5500                            (hex literal)
 */

import { addCmd, dbojs, send } from "@ursamu/ursamu";
import type { IDBOBJ, IUrsamuSDK } from "@ursamu/ursamu";
import { error, info, success, usage } from "./messages.ts";
import { gradientName }  from "./gradient.ts";

export async function execGName(u: IUrsamuSDK): Promise<void> {
  const sid = u.socketId || "";
  const playerObj = await dbojs.queryOne({ id: u.me.id });
  if (!playerObj) return send([sid], error("Player not found."));

  const raw = (u.cmd.args[0] ?? "").trim();
  const name = (playerObj.data?.name as string) || "Unknown";

  if (!raw) {
    const current = (playerObj.data?.moniker as string) || "";
    if (!current) return send([sid], info(`No gradient set. Name displays as: ${name}`));
    return send([sid], info(`Current moniker: ${current}`));
  }

  const lower = raw.toLowerCase();
  if (lower === "reset" || lower === "clear") {
    await dbojs.modify(
      { id: playerObj.id },
      "$unset",
      { "data.moniker": 1 } as unknown as Partial<IDBOBJ>,
    );
    return send([sid], success(`Moniker cleared. Name displays as: ${name}`));
  }

  const stops = raw.split(/\s+/).filter(Boolean);
  if (stops.length < 2) {
    return send([sid], usage("+gname <color1> <color2> [<color3> ...]"));
  }

  const moniker = gradientName(name, stops);
  if (!moniker) {
    return send([sid], error(
      `One or more colors not recognized: ${stops.join(" ")}.\n` +
      `Try short ANSI (hr, hg, hb, ...), CSS names (gold, crimson, skyblue, ...), ` +
      `xterm names (DodgerBlue1, Salmon1, ...), or #rrggbb hex.`,
    ));
  }

  await dbojs.modify(
    { id: playerObj.id },
    "$set",
    { "data.moniker": moniker } as Partial<IDBOBJ>,
  );
  send([sid], success(`Moniker set. Preview: ${moniker}`));
}

export function registerGNameCommand(): void {
  addCmd({
    name: "+gname",
    pattern: /^\+gname(?:\s+(.*))?$/i,
    lock: "connected",
    category: "Profile",
    help: `+gname <color1> <color2> [<color3> ...]  — Set a gradient @moniker.

Blends the given colors (HSL, shortest-arc hue) across the letters of your
name and stores the result as your @moniker. Whitespace in your name is
preserved uncolored.

  +gname reset    Clear the gradient (restore plain name).
  +gname          Show the current setting.

Colors accepted:
  hr hg hy hb hm hc hw            (bright ANSI shorthand)
  r  g  y  b  m  c  w             (dark ANSI shorthand)
  gold crimson skyblue ...        (CSS named, 147 entries)
  DodgerBlue1 Salmon1 Grey50 ...  (xterm 256 names)
  #ff5500 / ff5500                (hex literal)

Examples:
  +gname gold red                Two-stop yellow-to-red.
  +gname red blue green          Three-stop rainbow-ish.
  +gname #ff00aa #00ffff         Hex stops.
  +gname reset                   Back to plain.`,
    exec: execGName,
  });
}
