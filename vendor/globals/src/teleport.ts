/**
 * Staff teleport convenience set: +summon, +rsummon, +join, +rjoin.
 *
 *   +summon  <player>   Teleport target to your room; remember their origin.
 *   +rsummon <player>   Teleport target back to their remembered origin.
 *   +join    <player>   Teleport yourself to target's room; remember origin.
 *   +rjoin              Teleport yourself back to your remembered origin.
 *
 * Origins are stored as small pointers on the affected object:
 *   data.summon_origin  on the target (set by +summon)
 *   data.join_origin    on the actor  (set by +join)
 */

import { addCmd, dbojs, send } from "@ursamu/ursamu";
import type { IDBObj, IDBOBJ, IUrsamuSDK } from "@ursamu/ursamu";
import { error, info, success } from "./messages.ts";

async function resolveTarget(u: IUrsamuSDK, ref: string): Promise<IDBObj | null> {
  if (!ref) return null;
  return (await u.util.target(u.me, ref, true)) ?? null;
}

export async function execSummon(u: IUrsamuSDK): Promise<void> {
  const sid = u.socketId || "";
  const ref = u.util.stripSubs(u.cmd.args[0] ?? "").trim();
  const target = await resolveTarget(u, ref);
  if (!target) { send([sid], error(`No one found matching '${ref}'.`)); return; }
  if (!target.flags.has("player")) { send([sid], error("You can only summon players.")); return; }

  const origin = target.location;
  if (!origin) { send([sid], error("Target has no current location to remember.")); return; }
  if (origin === u.here?.id) { send([sid], info(`${target.name} is already here.`)); return; }

  await dbojs.modify({ id: target.id }, "$set", { "data.summon_origin": origin } as Partial<IDBOBJ>);
  u.teleport(target.id, u.here!.id);
  send([sid], success(`Summoned ${target.name}.`));
}

export async function execRSummon(u: IUrsamuSDK): Promise<void> {
  const sid = u.socketId || "";
  const ref = u.util.stripSubs(u.cmd.args[0] ?? "").trim();
  const target = await resolveTarget(u, ref);
  if (!target) { send([sid], error(`No one found matching '${ref}'.`)); return; }

  const targetRec = await dbojs.queryOne({ id: target.id });
  const origin = targetRec?.data?.summon_origin as string | undefined;
  if (!origin) { send([sid], error(`${target.name} has no summon origin recorded.`)); return; }

  await dbojs.modify({ id: target.id }, "$unset", { "data.summon_origin": 1 } as unknown as Partial<IDBOBJ>);
  u.teleport(target.id, origin);
  send([sid], success(`Returned ${target.name} to their previous location.`));
}

export async function execJoin(u: IUrsamuSDK): Promise<void> {
  const sid = u.socketId || "";
  const ref = u.util.stripSubs(u.cmd.args[0] ?? "").trim();
  const target = await resolveTarget(u, ref);
  if (!target) { send([sid], error(`No one found matching '${ref}'.`)); return; }
  if (!target.flags.has("player")) { send([sid], error("You can only join players.")); return; }

  const dest = target.location;
  if (!dest) { send([sid], error("Target has no current location.")); return; }
  if (dest === u.here?.id) { send([sid], info(`You're already with ${target.name}.`)); return; }

  const origin = u.here?.id;
  if (origin) {
    await dbojs.modify({ id: u.me.id }, "$set", { "data.join_origin": origin } as Partial<IDBOBJ>);
  }
  u.teleport(u.me.id, dest);
  send([sid], success(`Joined ${target.name}.`));
}

export async function execRJoin(u: IUrsamuSDK): Promise<void> {
  const sid = u.socketId || "";
  const me = await dbojs.queryOne({ id: u.me.id });
  const origin = me?.data?.join_origin as string | undefined;
  if (!origin) { send([sid], error("You have no join origin recorded.")); return; }

  await dbojs.modify({ id: u.me.id }, "$unset", { "data.join_origin": 1 } as unknown as Partial<IDBOBJ>);
  u.teleport(u.me.id, origin);
  send([sid], success("Returned to your previous location."));
}

export function registerTeleportCommands(): void {
  addCmd({
    name: "+summon",
    pattern: /^\+summon\s+(.*)/i,
    lock: "connected admin+",
    category: "Staff",
    help: `+summon <player>  — Teleport a player to your current location.

Remembers their origin so +rsummon can return them.

Examples:
  +summon Alice    Bring Alice here.`,
    exec: execSummon,
  });

  addCmd({
    name: "+rsummon",
    pattern: /^\+rsummon\s+(.*)/i,
    lock: "connected admin+",
    category: "Staff",
    help: `+rsummon <player>  — Send a previously-summoned player back to their origin.

Examples:
  +rsummon Alice   Return Alice to where you summoned her from.`,
    exec: execRSummon,
  });

  addCmd({
    name: "+join",
    pattern: /^\+join\s+(.*)/i,
    lock: "connected admin+",
    category: "Staff",
    help: `+join <player>  — Teleport yourself to a player's current location.

Remembers your origin so +rjoin can return you.

Examples:
  +join Alice      Go wherever Alice is.`,
    exec: execJoin,
  });

  addCmd({
    name: "+rjoin",
    pattern: /^\+rjoin$/i,
    lock: "connected admin+",
    category: "Staff",
    help: `+rjoin  — Return yourself to where you were before your last +join.

Examples:
  +rjoin           Go back.`,
    exec: execRJoin,
  });
}
