/**
 * @exittype — convenience setter for the TYPE attribute on an exit.
 *
 * The look command groups exits by their TYPE attribute. Builders can use
 * either `&type <exit>=<value>` (canonical attribute syntax) or this
 * `@exittype <exit>=<value>` wrapper. They write to the same attribute.
 */

import { addCmd } from "@ursamu/ursamu";
import type { IUrsamuSDK } from "@ursamu/ursamu";
import { error, info, success, usage } from "./messages.ts";

export async function execExitType(u: IUrsamuSDK): Promise<void> {
  const ref   = u.util.stripSubs(u.cmd.args[0] ?? "").trim();
  const value = u.util.stripSubs(u.cmd.args[1] ?? "").trim();

  if (!ref) {
    u.send(usage("@exittype <exit>=<value>"));
    return;
  }

  const target = await u.util.target(u.me, ref, true);
  if (!target) {
    u.send(error(`No exit found matching '${ref}'.`));
    return;
  }
  if (!target.flags.has("exit")) {
    u.send(error(`${u.util.displayName(target, u.me)} is not an exit.`));
    return;
  }
  if (!(await u.canEdit(u.me, target))) {
    u.send(error("Permission denied."));
    return;
  }

  const name = u.util.displayName(target, u.me);

  if (!value) {
    const removed = await u.attr.clear(target.id, "TYPE");
    if (!removed) {
      u.send(info(`${name} had no TYPE set.`));
      return;
    }
    u.send(success(`Cleared TYPE on ${name}.`));
    return;
  }

  await u.attr.set(target.id, "TYPE", value);
  u.send(success(`Set TYPE on ${name} to ${value}.`));
}

export function registerExitTypeCommand(): void {
  addCmd({
    name: "@exittype",
    pattern: /^@exittype\s+(.+?)\s*=\s*(.*)$/i,
    lock: "connected builder+",
    category: "Building",
    help: `@exittype <exit>=<value>  — Set the TYPE attribute on an exit.

The look command groups exits into sections by their TYPE attribute,
sorted alphabetically. Setting <value> to empty clears the attribute.
Equivalent to: &type <exit>=<value>

Examples:
  @exittype north=direction        Tag the north exit as a direction.
  @exittype Inn=tavern             Tag the Inn exit as type "tavern".
  @exittype "Secret Hatch"=hidden  Tag a multi-word exit.
  @exittype north=                 Clear the TYPE attribute.`,
    exec: execExitType,
  });
}
