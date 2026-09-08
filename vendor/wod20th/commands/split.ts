// commands/split.ts -- +split for declaring multiple actions in a turn.
//
// Canon WoD20: declare N actions in your turn; each action's roll takes
// a -(N-1) penalty. The declaration auto-clears once N actions are
// consumed (by +attack or a triggered declared +defend).

import { addCmd } from "@ursamu/ursamu";
import type { IUrsamuSDK } from "@ursamu/ursamu";
import { findByPlayer, saveChar, unsetCharFields } from "../db/charDb.ts";
import { declareSplit, splitPenalty } from "../core/actions.ts";

addCmd({
  name: "+split",
  pattern: /^\+split(?:\/(\S+))?\s*(.*)/i,
  lock: "connected",
  category: "Combat",
  help: `+split <N>  -- Declare N actions this turn; each takes -(N-1) dice.

SYNTAX
  +split <N>             Declare N actions (1-5). Each action pays -(N-1).
  +split/clear           Cancel a declaration.
  +split                 Show your current declaration.

EXAMPLES
  +split 2               Take two actions this turn; each rolls at -1.
  +split 3               Three actions, each at -2.
  +split/clear           Drop it and return to a single full-pool action.

NOTES
  +attack consumes one slot. A declared +defend consumed by an incoming
  attack also consumes one slot. When all slots are used the declaration
  clears. Auto-half passive defenses are FREE and do not consume slots.

  A declared +defend with no +split (count=1) is an "abort to defense":
  full-pool defense, no other action this turn.

SEE ALSO: +help attack, +help defend, +help init`,

  exec: async (u: IUrsamuSDK) => {
    const sw  = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const arg = u.util.stripSubs(u.cmd.args[1] ?? "").trim();
    const char = await findByPlayer(u.me.id);
    if (!char) { u.send("You have no character on file."); return; }

    if (sw === "clear") {
      if (!char.actionDecl) { u.send("You have no action declaration."); return; }
      await unsetCharFields(char.id, ["actionDecl"]);
      u.send("%cyAction declaration cleared.%cn");
      return;
    }

    if (!sw && !arg) {
      const d = char.actionDecl;
      if (!d) {
        u.send("No split declared. Default: 1 action, full pool.");
        return;
      }
      u.send(`%cyDeclared:%cn ${d.count} action(s), ${d.used} used, ` +
             `penalty -${splitPenalty(char)} per roll.`);
      return;
    }

    const num = arg || sw;
    const n = Number.parseInt(num, 10);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      u.send("Usage: +split <N>  (N = 1..5)");
      return;
    }

    declareSplit(char, n);
    await saveChar(char);
    if (n === 1) {
      u.send("Declared 1 action -- single full-pool action this turn.");
    } else {
      u.send(`%cgDeclared ${n} actions; each rolls at %cy-${n - 1}%cn%cg dice.%cn`);
    }
  },
});
