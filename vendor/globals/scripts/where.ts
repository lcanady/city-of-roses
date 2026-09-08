import { IUrsamuSDK, IDBObj } from "../../@types/UrsamuSDK.ts";
import {
  renderHeader,
  renderDivider,
  renderFooter,
} from "../src/renderer.ts";

/**
 * Rhost Vision: where.ts
 * +where - show online players grouped by area/zone.
 *
 * Borders use the package theme renderer (header/divider/footer).
 */

export const aliases = ["+where", "where"];

const WIDTH = 78;

function formatIdle(lastCommand: unknown): { text: string; seconds: number } {
  if (typeof lastCommand !== "number") return { text: "??", seconds: 99999 };
  const diff = Math.floor((Date.now() - lastCommand) / 1000);
  let text: string;
  if (diff < 60) text = `${diff}s`;
  else if (diff < 3600) text = `${Math.floor(diff / 60)}m`;
  else if (diff < 86400) text = `${Math.floor(diff / 3600)}h`;
  else text = `${Math.floor(diff / 86400)}d`;
  return { text, seconds: diff };
}

function colorIdle(text: string, seconds: number): string {
  if (seconds < 60) return `%cg${text}%cn`;
  if (seconds < 600) return `%cg${text}%cn`;
  if (seconds < 3600) return `%cy${text}%cn`;
  if (seconds < 86400) return `%cy${text}%cn`;
  return `%ch%cx${text}%cn`;
}

function isStaff(player: IDBObj): boolean {
  return (
    player.flags.has("superuser") ||
    player.flags.has("admin") ||
    player.flags.has("wizard")
  );
}

export default async (u: IUrsamuSDK) => {
  const allPlayers = (await u.db.search({ flags: /connected/i })).filter(
    (p: IDBObj) => p.flags.has("player"),
  );

  const callerIsStaff = isStaff(u.me);

  interface PlayerInfo {
    name: string;
    colorName: string;
    staff: boolean;
    idle: string;
    idleSeconds: number;
    location: string;
    area: string;
    unfindable: boolean;
    dark: boolean;
  }

  const players: PlayerInfo[] = [];

  for (const p of allPlayers) {
    const name = (p.state?.moniker as string) || (p.state?.name as string) || p.name || "Unknown";
    const nc = (p.state?.name_color as string) || "";
    const colorName = nc && name.length > 0
      ? `${nc}${name[0]}%cn%ch%cw${name.slice(1)}%cn`
      : name;
    const staff = isStaff(p);
    const dark = p.flags.has("dark");
    const { text: idle, seconds: idleSeconds } = formatIdle(p.state?.lastCommand);

    // Get room info
    const roomName = u.here && p.id === u.me.id
      ? ((u.here.state?.name as string) || u.here.name || "Unknown")
      : "Unknown";

    // Look up the player's room
    let location = "Unknown";
    let area = "Unknown";
    let unfindable = false;

    const locId = p.location;
    if (locId) {
      const rooms = await u.db.search({ id: locId });
      if (rooms.length > 0) {
        const room = rooms[0];
        location = (room.state?.name as string) || room.name || "Unknown";
        location = location.replace(/\s*#\d+$/, "");
        area = (room.state?.grid_area as string) || "Unknown";
        unfindable = room.flags.has("dark") || room.flags.has("unfindable");
      }
    }

    players.push({ name, colorName, staff, idle, idleSeconds, location, area, unfindable, dark });
  }

  // Group by area
  const areas = new Map<string, PlayerInfo[]>();
  const unfindablePlayers: PlayerInfo[] = [];

  for (const p of players) {
    // Skip dark players from non-staff view
    if (p.dark && !callerIsStaff) continue;

    if (p.unfindable && !callerIsStaff) {
      unfindablePlayers.push(p);
    } else {
      const list = areas.get(p.area) || [];
      list.push(p);
      areas.set(p.area, list);
    }
  }

  // Sort players within each area alphabetically
  for (const [, list] of areas) {
    list.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }

  // Sort areas alphabetically, OOC always last
  const sortedAreas = [...areas.keys()].sort((a, b) => {
    if (a.toUpperCase() === "OOC") return 1;
    if (b.toUpperCase() === "OOC") return -1;
    return a.toLowerCase().localeCompare(b.toLowerCase());
  });

  // Build output
  const lines: string[] = [];

  lines.push(await renderHeader("Player Locations", WIDTH));

  // Column headers
  lines.push(
    ` %cc${"Player".padEnd(20)}  ${"Type".padEnd(6)} ${"Idle".padStart(4)}  Location%cn`,
  );
  lines.push(await renderDivider(null, WIDTH));

  for (const area of sortedAreas) {
    lines.push(await renderDivider(area, WIDTH));

    const list = areas.get(area) || [];
    for (const p of list) {
      const namePad = " ".repeat(Math.max(1, 20 - p.name.length));
      const typeCol = p.staff ? "%chStaff%cn " : "      ";
      const idleColored = colorIdle(p.idle, p.idleSeconds);
      const idlePadded = p.idle.padStart(4);
      const idleCol = idlePadded.replace(p.idle, idleColored);
      const locCol = p.location;

      lines.push(
        ` ${p.colorName}${namePad}  ${typeCol} ${idleCol}  ${locCol}`,
      );
    }
  }

  // Unfindable section
  if (unfindablePlayers.length > 0) {
    lines.push(await renderDivider("Unfindable", WIDTH));
    unfindablePlayers.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );
    for (const p of unfindablePlayers) {
      const idleColored = colorIdle(p.idle, p.idleSeconds);
      lines.push(`  ${p.colorName} ${idleColored}`);
    }
  }

  lines.push(await renderDivider(null, WIDTH));
  const count = players.filter((p) => !p.dark || callerIsStaff).length;
  const countLine = count === 1
    ? "  There is 1 player online."
    : `  There are ${count} players online.`;
  lines.push(countLine);
  lines.push(await renderFooter(WIDTH));

  u.send(lines.join("\n"));
};
