// commands/chargen.ts -- +chargen command with all switches.
import { addCmd } from "@ursamu/ursamu";
import { divider, footer, header } from "../core/format.ts";
import type { IUrsamuSDK } from "@ursamu/ursamu";
import { createChar, findByPlayer, saveChar, setStatus, findSubmitted } from "../db/charDb.ts";
import { applySet, applySpend, applyUnspend, advanceStep, applyNote, deleteNote, setNotePublic, applyPriority } from "../core/chargen.ts";
import {
  formatSheet, formatBudget, formatDashboard, formatGiftList, formatQueue,
} from "../core/renderer.ts";
import { validateStep } from "../core/validator.ts";
import { SplatRegistry } from "../core/registry.ts";
import { allTraitNames } from "../core/resolver.ts";
import {
  emitChargenStarted, emitChargenSubmitted, emitChargenApproved,
  emitChargenDenied, emitChargenReset, emitChargenStep, emitCharCreated,
} from "../hooks.ts";
import type { SplatId } from "../core/types.ts";
import { notifyChargenChannel, sendChargenMail } from "../integrations.ts";

// -- Template definitions ----------------------------------------------------
// Player-facing template names -> splat mappings.
// "shifter" is a meta-template that requires a subtype selection.

const TEMPLATES = {
  mortal: {
    label: "Mortal",
    desc:  "A mortal human.",
    splat: "mortal" as SplatId,
  },
  kinfolk: {
    label: "Kinfolk",
    desc:  "Wolf-blood relations of the Garou Nation.",
    splat: "kinfolk" as SplatId,
  },
  vampire: {
    label: "Vampire",
    desc:  "Vampire: the Masquerade (V20).",
    splat: "vtm" as SplatId,
  },
  shifter: {
    label: "Shifter",
    desc:  "Shapeshifter -- choose a type in the next step.",
    subtypes: {
      garou: {
        label: "Garou",
        desc:  "Werewolf: the Apocalypse.",
        splat: "wta" as SplatId,
      },
    },
  },
} as const;

type TemplateKey = keyof typeof TEMPLATES;

addCmd({
  name: "+chargen",
  pattern: /^\+chargen(?:\/(\S+))?\s*(.*)/i,
  lock: "connected",
  category: "Character Generation",
  help: `+chargen[/<switch>] [<args>]  -- WoD20th character generation.

Switches:
  /start                        Begin chargen (shows template picker)
  /template <splat>             Select a template to start chargen
  /set <trait>=<value>          Set any chargen trait (universal setter)
  /priority <kind>=<a>/<b>/<c>  Set attribute or ability priority
                                kind is "attrs" or "abilities"
  /set merit=<name>             Add (or remove) a merit -- costs freebies
  /set flaw=<name>              Add (or remove) a flaw -- gives freebies (<=7 cap)
  /spend <trait>=<dots>         Spend freebie points on a trait (Step 6)
  /unspend <trait>              Remove last freebie entry for a trait
  /freebies                     Show freebie log and remaining points
  /meritlist [<category>]       Browse available merits
  /flawlist [<category>]        Browse available flaws
  /giftlist [<pool>]            List available gifts (breed/auspice/tribe)
  /traits                       List all valid trait names
  /notes/set <name>=<text>      Write a personal note on your character
  /notes/clear <name>           Delete a named note
  /notes/public <name>          Make a note visible to staff/viewers
  /notes/list                   List all your notes
  /submit                       Submit character for staff approval
  /reset                        Wipe and restart chargen
  /approve <target>             (Staff) Approve a character
  /deny <target>=<reason>       (Staff) Deny a character
  /note <target>=<text>         (Staff) Add a staff note
  /staffreset <target>          (Staff) Wipe another player's chargen
  /queue                        (Staff) List submitted characters

Examples:
  +chargen                          Show progress dashboard
  +chargen/start                    Show the template picker
  +chargen/template mortal          Start chargen as a Mortal
  +chargen/template vampire         Start chargen as a Vampire (V20)
  +chargen/template shifter/garou   Start chargen as Garou
  +chargen/set breed=homid          Set breed to Homid
  +chargen/set tribe=Black Furies   Set tribe (fuzzy match)
  +chargen/set Strength=3           Assign 3 extra dots to Strength
  +chargen/set Strength.specialty=Lifting  Assign a specialty
  +chargen/priority attrs=physical/social/mental
  +chargen/priority abilities=talents/skills/knowledges
  +chargen/spend Gnosis=1           Buy 1 extra Gnosis dot with freebies
  +chargen/notes/set bg=My backstory text here
  +chargen/notes/list               List all notes
  +chargen/submit                   Submit for approval`,

  exec: async (u: IUrsamuSDK) => {
    const sw  = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const arg = (u.cmd.args[1] ?? "").trim();

    // -- No switch: dashboard or template picker -----------------------------
    if (!sw) {
      const char = await findByPlayer(u.me.id);
      if (!char || char.status === "denied") {
        u.send(await formatTemplatePicker());
        return;
      }
      u.send(await formatDashboard(char));
      return;
    }

    // -- /template -----------------------------------------------------------
    if (sw === "template") {
      const existing = await findByPlayer(u.me.id);
      if (existing && existing.status !== "denied") {
        u.send(`%cyYou already have a character in progress (${existing.status}).%cn Use +chargen/reset to start over.`);
        return;
      }

      const [templateKey, subtypeKey] = arg.toLowerCase().split("/").map((s) => s.trim()) as [string, string | undefined];
      const tmpl = TEMPLATES[templateKey as TemplateKey];

      if (!tmpl) {
        u.send(`%crUnknown template "${templateKey}".%cn%r${await formatTemplatePicker()}`);
        return;
      }

      if ("subtypes" in tmpl) {
        // Shifter-type: needs a subtype
        if (!subtypeKey) {
          u.send(await formatSubtypePicker(templateKey as TemplateKey));
          return;
        }
        const sub = tmpl.subtypes[subtypeKey as keyof typeof tmpl.subtypes];
        if (!sub) {
          u.send(`%crUnknown type "${subtypeKey}" for ${tmpl.label}.%cn%r${await formatSubtypePicker(templateKey as TemplateKey)}`);
          return;
        }
        const splatDef = SplatRegistry.get(sub.splat);
        if (splatDef?.requiredFlag && !u.me.flags.has(splatDef.requiredFlag)) {
          u.send(`%crAccess to "${splatDef.name}" requires the "${splatDef.requiredFlag}" flag. Contact staff.%cn`);
          return;
        }
        const char = await createChar(u.me.id, sub.splat);
        emitCharCreated(u.me.id, char.id, sub.splat);
        emitChargenStarted(u.me.id, char.id, sub.splat);
        u.send(`%chChargen started as ${sub.label} (${tmpl.label}).%cn%r${await formatDashboard(char)}`);
      } else {
        // Direct splat
        const splatDef = SplatRegistry.get(tmpl.splat);
        if (splatDef?.requiredFlag && !u.me.flags.has(splatDef.requiredFlag)) {
          u.send(`%crAccess to "${splatDef.name}" requires the "${splatDef.requiredFlag}" flag. Contact staff.%cn`);
          return;
        }
        const char = await createChar(u.me.id, tmpl.splat);
        emitCharCreated(u.me.id, char.id, tmpl.splat);
        emitChargenStarted(u.me.id, char.id, tmpl.splat);
        u.send(`%chChargen started as ${tmpl.label}.%cn%r${await formatDashboard(char)}`);
      }
      return;
    }

    // -- /start --------------------------------------------------------------
    if (sw === "start") {
      const existing = await findByPlayer(u.me.id);
      if (existing && existing.status !== "denied") {
        u.send(`%cyYou already have a character in progress (${existing.status}).%cn Use +chargen/reset to start over.`);
        return;
      }
      u.send(await formatTemplatePicker());
      return;
    }

    // -- Staff switches: operate on other players, don't need own character -
    if (sw === "queue" || sw === "approve" || sw === "deny" || sw === "note" || sw === "staffreset") {
      if (!u.me.flags.has("admin") && !u.me.flags.has("wizard") && !u.me.flags.has("superuser")) {
        u.send("Permission denied.");
        return;
      }
      if (sw === "queue") {
        const submitted = await findSubmitted();
        u.send(await formatQueue(submitted));
        return;
      }
      if (sw === "approve") {
        const target = await u.util.target(u.me, u.util.stripSubs(arg), true);
        if (!target) { u.send("Target not found."); return; }
        const targetChar = await findByPlayer(target.id);
        if (!targetChar) { u.send(`${u.util.displayName(target, u.me)} has no character.`); return; }
        if (targetChar.status !== "submitted") {
          u.send(`${u.util.displayName(target, u.me)}'s character is not submitted (currently ${targetChar.status}).`);
          return;
        }
        await setStatus(targetChar.id, "approved", { approvedBy: u.me.id });
        const currentFlags = new Set(target.flags);
        currentFlags.add("approved");
        await u.db.modify(target.id, "$set", { "flags": [...currentFlags] });
        emitChargenApproved({ playerId: target.id, charId: targetChar.id, approvedBy: u.me.id, splat: targetChar.splat });
        u.send(`%cg${u.util.displayName(target, u.me)}'s character approved.%cn`);
        u.send(`%cgYour character has been approved! Welcome to the game.%cn`, target.id);
        await sendChargenMail(
          u.me.id,
          target.id,
          "Welcome -- character approved",
          `Your ${targetChar.splat ?? "character"} has been approved by ${u.util.displayName(u.me, target)}.\n\n` +
          `You are cleared to play. Type +sheet to review your final stats, +help for command guidance, and +chargen if you need to revisit notes.\n\n` +
          `Welcome to the chronicle.`,
        );
        await notifyChargenChannel(
          `${u.util.displayName(target, u.me)} was approved by ${u.util.displayName(u.me, u.me)}.`,
        );
        return;
      }
      if (sw === "deny") {
        const eqIdx = arg.indexOf("=");
        if (eqIdx === -1) { u.send("Usage: +chargen/deny <target>=<reason>"); return; }
        const targetName = u.util.stripSubs(arg.slice(0, eqIdx)).trim();
        const reason     = u.util.stripSubs(arg.slice(eqIdx + 1)).trim();
        const target = await u.util.target(u.me, targetName, true);
        if (!target) { u.send("Target not found."); return; }
        const targetChar = await findByPlayer(target.id);
        if (!targetChar) { u.send(`${u.util.displayName(target, u.me)} has no character.`); return; }
        await setStatus(targetChar.id, "denied", { deniedReason: reason });
        emitChargenDenied({ playerId: target.id, charId: targetChar.id, deniedBy: u.me.id, reason });
        u.send(`${u.util.displayName(target, u.me)}'s character denied.`);
        u.send(`%crYour character application was denied.%cn Reason: ${reason}%rYou may use +chargen/reset and reapply.`, target.id);
        await sendChargenMail(
          u.me.id,
          target.id,
          "Character application denied",
          `Your character application was denied by ${u.util.displayName(u.me, target)}.\n\n` +
          `Reason given:\n  ${reason}\n\n` +
          `You may revise your application with +chargen, or wipe and restart with '+chargen/reset confirm'. ` +
          `If you have questions or want guidance, reply to this mail or page staff in-game.`,
        );
        return;
      }
      if (sw === "note") {
        const eqIdx = arg.indexOf("=");
        if (eqIdx === -1) { u.send("Usage: +chargen/note <target>=<text>"); return; }
        const targetName = u.util.stripSubs(arg.slice(0, eqIdx)).trim();
        const note       = u.util.stripSubs(arg.slice(eqIdx + 1)).trim();
        const target = await u.util.target(u.me, targetName, true);
        if (!target) { u.send("Target not found."); return; }
        const targetChar = await findByPlayer(target.id);
        if (!targetChar) { u.send("No character found."); return; }
        targetChar.staffNotes = targetChar.staffNotes
          ? `${targetChar.staffNotes}\n${note}`
          : note;
        await saveChar(targetChar);
        u.send(`Note added to ${u.util.displayName(target, u.me)}'s character.`);
        return;
      }
      if (sw === "staffreset") {
        const target = await u.util.target(u.me, u.util.stripSubs(arg), true);
        if (!target) { u.send("Target not found."); return; }
        if (target.id === u.me.id) { u.send("Use +chargen/reset for your own character."); return; }
        const targetChar = await findByPlayer(target.id);
        if (!targetChar) { u.send(`${u.util.displayName(target, u.me)} has no character in progress.`); return; }
        const oldId = targetChar.id;
        await setStatus(oldId, "denied");
        emitChargenReset(target.id, oldId);
        u.send(`%cy${u.util.displayName(target, u.me)}'s chargen wiped.%cn`);
        u.send(`%cyYour character generation has been reset by staff.%cn%r` + await formatTemplatePicker(), target.id);
        return;
      }
    }

    // All remaining switches require an existing character
    const char = await findByPlayer(u.me.id);
    if (!char) {
      u.send("No character in progress. Use %ch+chargen/start%cn to begin.");
      return;
    }

    // Gate: write operations require draft or denied status
    const canEdit = char.status === "draft" || char.status === "denied";

    // -- /set -----------------------------------------------------------------
    if (sw === "set") {
      if (!canEdit) {
        u.send(`%crYour character is ${char.status} and cannot be edited.%cn`);
        return;
      }
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) {
        u.send("Usage: +chargen/set <trait>=<value>");
        return;
      }
      const trait = u.util.stripSubs(arg.slice(0, eqIdx)).trim();
      const value = u.util.stripSubs(arg.slice(eqIdx + 1)).trim();
      const result = applySet(char as unknown as Parameters<typeof applySet>[0], trait, value);

      if (!result.ok) {
        u.send(`%cr${result.message}%cn`);
        if (result.budget) u.send(await formatBudget(result.budget));
        return;
      }

      // Check if this completes the current step and auto-advance
      const current = char.chargenStep;
      const advance = advanceStep(char as unknown as Parameters<typeof advanceStep>[0]);
      if (advance.ok && char.chargenStep > current) {
        emitChargenStep(u.me.id, char.id, char.splat, current);
        await saveChar(char as unknown as Awaited<ReturnType<typeof findByPlayer>> extends null ? never : NonNullable<Awaited<ReturnType<typeof findByPlayer>>>);
        u.send(`${result.message}%r%cg[X] Step ${current} complete!%cn Auto-advanced to Step ${char.chargenStep}.`);
        u.send(await formatBudget(result.budget!));
        return;
      }

      await saveChar(char as NonNullable<typeof char>);
      u.send(result.message);
      if (result.budget) u.send(await formatBudget(result.budget));
      return;
    }

    // -- /priority ------------------------------------------------------------
    if (sw === "priority") {
      if (!canEdit) {
        u.send(`%crYour character is ${char.status} and cannot be edited.%cn`);
        return;
      }
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) {
        u.send("Usage: +chargen/priority <attrs|abilities>=<a>/<b>/<c>");
        return;
      }
      const kind  = u.util.stripSubs(arg.slice(0, eqIdx)).trim();
      const value = u.util.stripSubs(arg.slice(eqIdx + 1)).trim();
      const result = applyPriority(char as unknown as Parameters<typeof applyPriority>[0], kind, value);
      if (!result.ok) {
        u.send(`%cr${result.message}%cn`);
        if (result.budget) u.send(await formatBudget(result.budget));
        return;
      }

      const current = char.chargenStep;
      const advance = advanceStep(char as unknown as Parameters<typeof advanceStep>[0]);
      if (advance.ok && char.chargenStep > current) {
        emitChargenStep(u.me.id, char.id, char.splat, current);
        await saveChar(char as NonNullable<typeof char>);
        u.send(`${result.message}%r%cg[X] Step ${current} complete!%cn Auto-advanced to Step ${char.chargenStep}.`);
        if (result.budget) u.send(await formatBudget(result.budget));
        return;
      }

      await saveChar(char as NonNullable<typeof char>);
      u.send(result.message);
      if (result.budget) u.send(await formatBudget(result.budget));
      return;
    }

    // -- /spend ---------------------------------------------------------------
    if (sw === "spend") {
      if (!canEdit) {
        u.send(`%crYour character is ${char.status}.%cn`);
        return;
      }
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) {
        u.send("Usage: +chargen/spend <trait>=<dots>");
        return;
      }
      const trait = u.util.stripSubs(arg.slice(0, eqIdx)).trim();
      const dots  = arg.slice(eqIdx + 1).trim();
      const result = applySpend(char as unknown as Parameters<typeof applySpend>[0], trait, dots);
      if (!result.ok) { u.send(`%cr${result.message}%cn`); return; }
      await saveChar(char as NonNullable<typeof char>);
      u.send(result.message);
      if (result.budget) u.send(await formatBudget(result.budget));
      return;
    }

    // -- /unspend -------------------------------------------------------------
    if (sw === "unspend") {
      if (!canEdit) {
        u.send(`%crYour character is ${char.status}.%cn`);
        return;
      }
      const trait = u.util.stripSubs(arg).trim();
      const result = applyUnspend(char as unknown as Parameters<typeof applyUnspend>[0], trait);
      if (!result.ok) { u.send(`%cr${result.message}%cn`); return; }
      await saveChar(char as NonNullable<typeof char>);
      u.send(result.message);
      if (result.budget) u.send(await formatBudget(result.budget));
      return;
    }

    // -- /freebies ------------------------------------------------------------
    if (sw === "freebies") {
      const log = char.freebiesLog;
      if (log.length === 0) {
        u.send(`No freebie points spent. Remaining: %ch${char.freebiesRemaining}%cn`);
        return;
      }
      const lines = [header(" Freebie Points ")];
      log.forEach((e) => {
        const traitLabel = e.trait.length > 24 ? e.trait.slice(0, 23) + "..." : e.trait;
        lines.push(`  ${traitLabel.padEnd(24)} +${e.dots} dots  (${e.cost} pts)`);
      });
      lines.push(divider(null));
      lines.push(`Remaining: %ch${char.freebiesRemaining}%cn`);
      lines.push(footer());
      u.send(lines.join("%r"));
      return;
    }

    // -- /giftlist ------------------------------------------------------------
    if (sw === "giftlist") {
      u.send(await formatGiftList(char as unknown as Parameters<typeof formatGiftList>[0], arg || undefined));
      return;
    }

    // -- /traits --------------------------------------------------------------
    if (sw === "traits") {
      const names = allTraitNames(char as unknown as Parameters<typeof allTraitNames>[0]);
      u.send(`%chValid traits:%cn%r${names.join(", ")}`);
      return;
    }

    // -- /submit --------------------------------------------------------------
    if (sw === "submit") {
      if (char.status !== "draft") {
        u.send(`%cyAlready ${char.status}.%cn`);
        return;
      }

      // All 6 steps must be complete
      const issues: string[] = [];
      for (let s = 1; s <= 6; s++) {
        const b = validateStep(char as unknown as Parameters<typeof validateStep>[0], s as 1 | 2 | 3 | 4 | 5 | 6);
        if (!b.complete) issues.push(...b.issues.map((i) => `Step ${s}: ${i}`));
      }
      if (issues.length > 0) {
        const out = [
          header(" Cannot Submit -- Issues Found "),
          "%crFix the following before submitting:%cn",
          divider(null),
          ...issues.map((i) => `  * ${i}`),
          footer(),
        ];
        u.send(out.join("%r"));
        return;
      }

      await setStatus(char.id, "submitted");
      emitChargenSubmitted({
        playerId: u.me.id,
        charId: char.id,
        splat: char.splat,
        breed: char.breed,
        auspice: char.auspice,
        tribe: char.tribe,
        concept: char.concept,
      });
      u.send("%chCharacter submitted for staff review!%cn Staff will be in touch soon.");
      const submitterName = u.util.displayName(u.me, u.me);
      const splatLabel = char.splat ?? "unknown";
      await notifyChargenChannel(
        `${submitterName} submitted a ${splatLabel} character for review (+chargen/queue).`,
      );
      return;
    }

    // -- /reset ---------------------------------------------------------------
    if (sw === "reset") {
      if (char.status === "approved") {
        u.send("%crApproved characters cannot be self-reset. Contact staff to use +chargen/staffreset.%cn");
        return;
      }
      if (u.util.stripSubs(arg).toLowerCase() === "confirm") {
        const oldId = char.id;
        await setStatus(oldId, "denied"); // soft-delete by denying
        emitChargenReset(u.me.id, oldId);
        u.send("%cyChargen wiped.%cn%r" + await formatTemplatePicker());
      } else {
        u.send("%cyType %ch+chargen/reset confirm%cn%cy to wipe and restart.%cn");
      }
      return;
    }

    // -- Staff: /approve -------------------------------------------------------
    if (sw === "approve") {
      if (!u.me.flags.has("admin") && !u.me.flags.has("wizard") && !u.me.flags.has("superuser")) {
        u.send("Permission denied.");
        return;
      }
      const target = await u.util.target(u.me, u.util.stripSubs(arg), true);
      if (!target) { u.send("Target not found."); return; }
      const targetChar = await findByPlayer(target.id);
      if (!targetChar) { u.send(`${u.util.displayName(target, u.me)} has no character.`); return; }
      if (targetChar.status !== "submitted") {
        u.send(`${u.util.displayName(target, u.me)}'s character is not submitted (currently ${targetChar.status}).`);
        return;
      }
      await setStatus(targetChar.id, "approved", { approvedBy: u.me.id });
      const currentFlags = new Set(target.flags);
      currentFlags.add("approved");
      await u.db.modify(target.id, "$set", { "flags": [...currentFlags] });
      emitChargenApproved({ playerId: target.id, charId: targetChar.id, approvedBy: u.me.id, splat: targetChar.splat });
      u.send(`%cg${u.util.displayName(target, u.me)}'s character approved.%cn`);
      u.send(`%cgYour character has been approved! Welcome to the game.%cn`, target.id);
      await sendChargenMail(
        u.me.id,
        target.id,
        "Welcome -- character approved",
        `Your ${targetChar.splat ?? "character"} has been approved by ${u.util.displayName(u.me, target)}.\n\n` +
        `You are cleared to play. Type +sheet to review your final stats, +help for command guidance, and +chargen if you need to revisit notes.\n\n` +
        `Welcome to the chronicle.`,
      );
      await notifyChargenChannel(
        `${u.util.displayName(target, u.me)} was approved by ${u.util.displayName(u.me, u.me)}.`,
      );
      return;
    }

    // -- Staff: /deny ----------------------------------------------------------
    if (sw === "deny") {
      if (!u.me.flags.has("admin") && !u.me.flags.has("wizard") && !u.me.flags.has("superuser")) {
        u.send("Permission denied.");
        return;
      }
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) { u.send("Usage: +chargen/deny <target>=<reason>"); return; }
      const targetName = u.util.stripSubs(arg.slice(0, eqIdx)).trim();
      const reason     = u.util.stripSubs(arg.slice(eqIdx + 1)).trim();
      const target = await u.util.target(u.me, targetName, true);
      if (!target) { u.send("Target not found."); return; }
      const targetChar = await findByPlayer(target.id);
      if (!targetChar) { u.send(`${u.util.displayName(target, u.me)} has no character.`); return; }
      await setStatus(targetChar.id, "denied", { deniedReason: reason });
      emitChargenDenied({ playerId: target.id, charId: targetChar.id, deniedBy: u.me.id, reason });
      u.send(`${u.util.displayName(target, u.me)}'s character denied.`);
      u.send(`%crYour character application was denied.%cn Reason: ${reason}%rYou may use +chargen/reset and reapply.`, target.id);
      await sendChargenMail(
        u.me.id,
        target.id,
        "Character application denied",
        `Your character application was denied by ${u.util.displayName(u.me, target)}.\n\n` +
        `Reason given:\n  ${reason}\n\n` +
        `You may revise your application with +chargen, or wipe and restart with '+chargen/reset confirm'. ` +
        `If you have questions or want guidance, reply to this mail or page staff in-game.`,
      );
      return;
    }

    // -- Staff: /note ----------------------------------------------------------
    if (sw === "note") {
      if (!u.me.flags.has("admin") && !u.me.flags.has("wizard") && !u.me.flags.has("superuser")) {
        u.send("Permission denied.");
        return;
      }
      const eqIdx = arg.indexOf("=");
      if (eqIdx === -1) { u.send("Usage: +chargen/note <target>=<text>"); return; }
      const targetName = u.util.stripSubs(arg.slice(0, eqIdx)).trim();
      const note       = u.util.stripSubs(arg.slice(eqIdx + 1)).trim();
      const target = await u.util.target(u.me, targetName, true);
      if (!target) { u.send("Target not found."); return; }
      const targetChar = await findByPlayer(target.id);
      if (!targetChar) { u.send("No character found."); return; }
      targetChar.staffNotes = targetChar.staffNotes
        ? `${targetChar.staffNotes}\n${note}`
        : note;
      await saveChar(targetChar);
      u.send(`Note added to ${u.util.displayName(target, u.me)}'s character.`);
      return;
    }

    // -- /meritlist ------------------------------------------------------------
    if (sw === "meritlist") {
      const splat = SplatRegistry.get(char.splat);
      if (!splat?.merits?.length) {
        u.send(`No merit list for ${splat?.name ?? char.splat}.`);
        return;
      }
      const cat = arg.trim().toLowerCase();
      const list = cat
        ? splat.merits.filter((m) => m.category.toLowerCase() === cat)
        : splat.merits;
      if (!list.length) { u.send(`No merits in category "${arg}".`); return; }
      const lines = [header(` Merits -- ${splat.name} `)];
      for (const m of list) {
        const notesText = (m.notes ?? "").slice(0, 30);
        lines.push(`  %ch${m.name}%cn (${m.cost} pt, ${m.category})  ${notesText}`);
      }
      lines.push(footer());
      u.send(lines.join("%r"));
      return;
    }

    // -- /flawlist -------------------------------------------------------------
    if (sw === "flawlist") {
      const splat = SplatRegistry.get(char.splat);
      if (!splat?.flaws?.length) {
        u.send(`No flaw list for ${splat?.name ?? char.splat}.`);
        return;
      }
      const cat = arg.trim().toLowerCase();
      const list = cat
        ? splat.flaws.filter((f) => f.category.toLowerCase() === cat)
        : splat.flaws;
      if (!list.length) { u.send(`No flaws in category "${arg}".`); return; }
      const lines = [header(` Flaws -- ${splat.name} `)];
      for (const f of list) {
        const notesText = (f.notes ?? "").slice(0, 30);
        lines.push(`  %ch${f.name}%cn (+${f.bonus} pt, ${f.category})  ${notesText}`);
      }
      lines.push(footer());
      u.send(lines.join("%r"));
      return;
    }

    // -- Staff: /staffreset ----------------------------------------------------
    if (sw === "staffreset") {
      if (!u.me.flags.has("admin") && !u.me.flags.has("wizard") && !u.me.flags.has("superuser")) {
        u.send("Permission denied.");
        return;
      }
      const target = await u.util.target(u.me, u.util.stripSubs(arg), true);
      if (!target) { u.send("Target not found."); return; }
      if (target.id === u.me.id) { u.send("Use +chargen/reset for your own character."); return; }
      const targetChar = await findByPlayer(target.id);
      if (!targetChar) { u.send(`${u.util.displayName(target, u.me)} has no character in progress.`); return; }
      const oldId = targetChar.id;
      await setStatus(oldId, "denied");
      emitChargenReset(target.id, oldId);
      u.send(`%cy${u.util.displayName(target, u.me)}'s chargen wiped.%cn`);
      u.send(`%cyYour character generation has been reset by staff.%cn%r` + await formatTemplatePicker(), target.id);
      return;
    }

    // -- Staff: /queue ---------------------------------------------------------
    if (sw === "queue") {
      if (!u.me.flags.has("admin") && !u.me.flags.has("wizard") && !u.me.flags.has("superuser")) {
        u.send("Permission denied.");
        return;
      }
      const submitted = await findSubmitted();
      u.send(await formatQueue(submitted));
      return;
    }

    // -- /notes ----------------------------------------------------------------
    if (sw === "notes") {
      if (!canEdit) {
        u.send(`%crYour character is ${char.status} and cannot be edited.%cn`);
        return;
      }
      // Parse sub-switch from arg: "set <name>=<text>", "clear <name>", "public <name>", "list"
      const spIdx = arg.indexOf(" ");
      const subSw = (spIdx === -1 ? arg : arg.slice(0, spIdx)).toLowerCase().trim();
      const rest  = spIdx === -1 ? "" : arg.slice(spIdx + 1).trim();

      if (subSw === "list" || (subSw === "" && rest === "")) {
        char.notes = char.notes ?? [];
        if (char.notes.length === 0) {
          u.send("No notes on your character. Use +chargen/notes set <name>=<text> to add one.");
          return;
        }
        const lines = [header(" Character Notes ")];
        for (const n of char.notes) {
          const vis = n.isPublic ? "%cgpublic%cn" : "private";
          lines.push(`  %ch${n.name}%cn (${vis})`);
        }
        lines.push(footer());
        u.send(lines.join("%r"));
        return;
      }

      if (subSw === "set") {
        const eqIdx = rest.indexOf("=");
        if (eqIdx === -1) {
          u.send("Usage: +chargen/notes set <name>=<text>");
          return;
        }
        const name = u.util.stripSubs(rest.slice(0, eqIdx)).trim();
        const text = u.util.stripSubs(rest.slice(eqIdx + 1)).trim();
        const result = applyNote(char as unknown as Parameters<typeof applyNote>[0], name, text);
        if (!result.ok) { u.send(`%cr${result.message}%cn`); return; }
        await saveChar(char as NonNullable<typeof char>);
        u.send(result.message);
        return;
      }

      if (subSw === "clear") {
        const name = u.util.stripSubs(rest).trim();
        if (!name) { u.send("Usage: +chargen/notes clear <name>"); return; }
        const result = deleteNote(char as unknown as Parameters<typeof deleteNote>[0], name);
        if (!result.ok) { u.send(`%cr${result.message}%cn`); return; }
        await saveChar(char as NonNullable<typeof char>);
        u.send(result.message);
        return;
      }

      if (subSw === "public") {
        const name = u.util.stripSubs(rest).trim();
        if (!name) { u.send("Usage: +chargen/notes public <name>"); return; }
        const result = setNotePublic(char as unknown as Parameters<typeof setNotePublic>[0], name, true);
        if (!result.ok) { u.send(`%cr${result.message}%cn`); return; }
        await saveChar(char as NonNullable<typeof char>);
        u.send(result.message);
        return;
      }

      u.send(`Unknown notes sub-command "${subSw}". Valid: set, clear, public, list`);
      return;
    }

    u.send(`Unknown switch "/${sw}". See %ch+help chargen%cn for valid switches.`);
  },
});

async function formatTemplatePicker(): Promise<string> {
  const lines: string[] = [
    header(" Character Generation -- Choose a Template "),
    "",
    "  %cwChoose the template that best fits your character concept:%cn",
    divider(null),
  ];
  for (const [key, tmpl] of Object.entries(TEMPLATES)) {
    const keyCol  = `%ch%cy${key}%cn` + " ".repeat(Math.max(0, 12 - key.length));
    const descStr = "subtypes" in tmpl
      ? `%ch${tmpl.label}%cn  %cw-%cn  choose a type in the next step`
      : `%ch${tmpl.label}%cn  %cw-%cn  ${tmpl.desc}`;
    lines.push(`    %cg>%cn ${keyCol}  ${descStr}`);
  }
  lines.push("");
  lines.push("  %cwType:%cn %ch%cc+chargen/template <name>%cn");
  lines.push(footer());
  return lines.join("%r");
}

async function formatSubtypePicker(templateKey: TemplateKey): Promise<string> {
  const tmpl = TEMPLATES[templateKey];
  if (!("subtypes" in tmpl)) return "";
  const lines: string[] = [
    header(` ${tmpl.label} -- Choose Your Type `),
    "",
  ];
  for (const [key, sub] of Object.entries(tmpl.subtypes)) {
    const keyCol = `%ch%cy${key}%cn` + " ".repeat(Math.max(0, 12 - key.length));
    lines.push(`    %cg>%cn ${keyCol}  %ch${sub.label}%cn  %cw-%cn  ${sub.desc}`);
  }
  lines.push("");
  lines.push(`  %cwType:%cn %ch%cc+chargen/template ${templateKey}/<type>%cn`);
  lines.push(footer());
  return lines.join("%r");
}
