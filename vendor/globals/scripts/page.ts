import { IUrsamuSDK } from "../../@types/UrsamuSDK.ts";

/**
 * Rhost Vision: page.ts
 * Rhost-style page formatting.
 *
 * page <target>=<message>  → Jupiter(J) pages: Hello!
 * page <target>=:<pose>    → From afar, Jupiter(J) waves.
 */
export default async (u: IUrsamuSDK) => {
  const actor = u.me;
  const input = (u.cmd.args[0] || "").trim();

  const match = input.match(/^(.+?)=(.*)$/);
  if (!match) {
    u.send("Usage: page <target>=<message>");
    return;
  }

  const targetName = match[1].trim();
  const rawMessage = match[2].trim();

  if (!rawMessage) {
    u.send("What do you want to say?");
    return;
  }

  // Resolve Target
  const target = (await u.db.search(targetName)).find(obj => obj.flags.has('player'));

  if (!target || target.flags.has("dark") || !target.flags.has("connected")) {
    u.send(`I can't find player "${targetName}" online.`);
    return;
  }

  // Build display names with alias and staff ANSI
  const actorAlias = actor.state?.alias as string | undefined;
  const actorBaseName = (actor.state?.moniker as string) || (actor.state?.name as string) || actor.name || "Someone";
  const actorNameColor = (actor.state?.name_color as string) || "";
  const actorColorName = actorNameColor && actorBaseName.length > 0
    ? `${actorNameColor}${actorBaseName[0]}%cn%ch%cw${actorBaseName.slice(1)}%cn`
    : actorBaseName;
  const actorColorDisplay = (actorAlias && typeof actorAlias === "string" && actorAlias.trim())
    ? `${actorColorName}(${actorAlias})`
    : actorColorName;
  const actorPlainDisplay = (actorAlias && typeof actorAlias === "string" && actorAlias.trim())
    ? `${actorBaseName}(${actorAlias})`
    : actorBaseName;

  const targetBaseName = (target.state?.moniker as string) || (target.state?.name as string) || target.name || "Someone";
  const targetNameColor = (target.state?.name_color as string) || "";
  const targetColorName = targetNameColor && targetBaseName.length > 0
    ? `${targetNameColor}${targetBaseName[0]}%cn%ch%cw${targetBaseName.slice(1)}%cn`
    : targetBaseName;

  // Check for pose (starts with :)
  if (rawMessage.startsWith(":")) {
    const pose = rawMessage.slice(1);
    // To target
    u.send(`From afar, ${actorColorDisplay} ${pose}`, target.id);
    // To sender
    u.send(`Long distance to ${targetColorName}: ${actorColorName} ${pose}`);
  } else {
    // Normal page
    // To target
    u.send(`${actorColorDisplay} pages: ${rawMessage}`, target.id);
    // To sender
    u.send(`You paged ${targetColorName} with '${rawMessage}'.`);
  }

  // Structured result for Web
  u.ui.layout({
    components: [],
    meta: {
      type: "page",
      actorId: actor.id,
      actorName: actorPlainDisplay,
      targetId: target.id,
      targetName: targetBaseName,
      message: rawMessage
    }
  });
};
