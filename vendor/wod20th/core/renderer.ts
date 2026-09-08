// core/renderer.ts -- MUSH-formatted output for sheets, budgets, and dashboards.
// Latin-1 safe: no Unicode beyond 0xFF. Numbers instead of dot graphics.
import type { IWoDChar, IStepBudget, IWtaSplatExt, IVtmSplatExt, DamageMark } from "./types.ts";
import type { IDiceRoll } from "./dice.ts";
import { SplatRegistry } from "./registry.ts";
import { header, divider, footer } from "./format.ts";
import {
  ATTRIBUTE_GROUPS,
  ABILITY_GROUPS,
} from "./attributes.ts";
import { validateStep } from "./validator.ts";
import { HEALTH_LEVELS, HEALTH_TRACK_SIZE, markChar } from "./health.ts";
import { FORM_MODIFIERS, FORM_ATTRS, defaultFormForBreed, type Form } from "./forms.ts";
import { frenzyRemaining, isFrenzied } from "./frenzy.ts";
import { nextRankRequirement, RANK_NAMES } from "./renown.ts";
import { normaliseAuspice } from "./renownThresholds.ts";
import { woundPenalty } from "./wounds.ts";

const W   = 78;           // display width
const COL = Math.floor(W / 3); // 26

// Three-column layout: [contentWidth, trailingSpaces]
// Totals: 26 + 26 + 26 = 78 chars -- 2-space gap between each col, no trailing on last.
const COL_LAYOUT = [[24, 2], [24, 2], [26, 0]] as const;

// Two-column layout for Backgrounds/Gifts: 39 + 39 = 78 chars.
const COL2_LAYOUT = [[37, 2], [39, 0]] as const;

// -- Public API -------------------------------------------------------------

/** Full character sheet. */
export async function formatSheet(char: IWoDChar, isStaff: boolean, playerName?: string): Promise<string> {
  const lines: string[] = [];

  const displayName = char.moniker || char.fullName || playerName || char.playerId;
  lines.push(header(`Character Sheet for: ${displayName}`));

  // Identity -- flow only set fields, two per row.
  const lbl = (key: string, val: string, w: number) =>
    `%ch${key}%cn${" ".repeat(Math.max(0, w - key.length))} ${val}`;

  const { breed: breedName, auspice: auspiceName, tribe: tribeName } = identityNames(char);

  // Always show all fields applicable to this template; value is blank until set.
  const idFields: string[] = [];
  idFields.push(lbl("Full Name:", char.fullName                            ?? "", 10));
  idFields.push(lbl("Concept:",   char.concept                             || "", 10));
  idFields.push(lbl("Age:",       char.age                                 ?? "", 10));
  idFields.push(lbl("Nature:",    char.nature                              ?? "", 10));
  idFields.push(lbl("Demeanor:",  char.demeanor                            ?? "", 10));
  if (char.splat === "wta" || char.splat === "kinfolk") {
    idFields.push(lbl("Breed:",   breedName, 10));
  }
  if (char.splat === "wta") {
    idFields.push(lbl("Auspice:", auspiceName, 10));
    idFields.push(lbl("Tribe:",   tribeName,   10));
    const curForm = (char.currentForm ?? defaultFormForBreed(char.breed)) as Form;
    const formName = curForm.charAt(0).toUpperCase() + curForm.slice(1);
    idFields.push(lbl("Form:",    formName, 10));
    if (char.deedName?.trim()) idFields.push(lbl("Deed:", char.deedName, 10));
  }
  if (char.splat === "kinfolk") {
    idFields.push(lbl("Tribe:",   tribeName,   10));
  }
  if (char.splat === "vtm") {
    const clanName = clanDisplay(char);
    idFields.push(lbl("Clan:",    clanName, 10));
    idFields.push(lbl("Path:",    char.path ?? "Humanity", 10));
    idFields.push(lbl("Gen:",     String(char.generation ?? 13), 10));
    idFields.push(lbl("Sire:",    char.sire ?? "", 10));
  }
  if (char.breed === "metis") {
    idFields.push(lbl("Deformity:", char.deformity                         ?? "", 10));
  }

  for (let i = 0; i < idFields.length; i += 2) {
    lines.push(cols2(idFields[i], idFields[i + 1] ?? ""));
  }

  // Attributes -- three columns: Physical | Social | Mental
  lines.push(divider("Attributes"));
  lines.push(traitTable(
    ["Physical", "Social", "Mental"],
    [
      ATTRIBUTE_GROUPS.physical as unknown as string[],
      ATTRIBUTE_GROUPS.social   as unknown as string[],
      ATTRIBUTE_GROUPS.mental   as unknown as string[],
    ],
    char.attributes, char.attributesTemp, char.attributeSpecialties, 1,
  ));

  // Form status line -- WtA only, only when in a non-homid form.
  if (char.splat === "wta") {
    const curForm = (char.currentForm ?? defaultFormForBreed(char.breed)) as Form;
    if (curForm !== "homid") {
      const mods = FORM_MODIFIERS[curForm];
      const cell = (a: string) => {
        const n = mods[a] ?? 0;
        const short = a.slice(0, 3);
        return `${short} ${n >= 0 ? "+" : ""}${n}`;
      };
      const formName = curForm.charAt(0).toUpperCase() + curForm.slice(1);
      lines.push(`%chForm:%cn ${formName}  (${FORM_ATTRS.map(cell).join(", ")})`);
    }
  }

  // Abilities -- three columns: Talents | Skills | Knowledges
  lines.push(divider("Abilities"));
  lines.push(traitTable(
    ["Talents", "Skills", "Knowledges"],
    [
      ABILITY_GROUPS.talents    as unknown as string[],
      ABILITY_GROUPS.skills     as unknown as string[],
      ABILITY_GROUPS.knowledges as unknown as string[],
    ],
    char.abilities, char.abilitiesTemp, char.abilitySpecialties, 0,
  ));

  // Specialties -- optional 2-col section
  const allSpecialties: [string, string][] = [
    ...Object.entries(char.attributeSpecialties),
    ...Object.entries(char.abilitySpecialties),
  ];
  if (allSpecialties.length > 0) {
    lines.push(divider("Specialties"));
    lines.push(...specialtiesTable(allSpecialties));
  }

  // Backgrounds -- 2-col dot-fill (hidden when empty)
  const bgEntries = Object.entries(char.backgrounds).filter(([, v]) => v > 0);
  if (bgEntries.length > 0) {
    lines.push(divider("Backgrounds"));
    lines.push(bgTable(char.backgrounds));
  }

  // Merits & Flaws -- left col merits, right col flaws
  if (Object.keys(char.merits ?? {}).length > 0 || Object.keys(char.flaws ?? {}).length > 0) {
    lines.push(divider("Merits & Flaws"));
    lines.push(...meritsFlawsTable(char.merits ?? {}, char.flaws ?? {}));
  }

  // Gifts (WtA) -- 2-col list (hidden when empty)
  if (char.splat === "wta") {
    const giftItems = (char.gifts ?? []).filter(Boolean);
    if (giftItems.length > 0) {
      lines.push(divider("Gifts"));
      for (let gi = 0; gi < giftItems.length; gi += 2) {
        const left  = giftItems[gi];
        const right = giftItems[gi + 1];
        lines.push(right ? padVisTo(left, COL2_LAYOUT[0][0] + COL2_LAYOUT[0][1]) + right : left);
      }
    }
  }

  // Disciplines & Virtues (VtM) -- 2-col dot-fill (hidden when empty)
  if (char.splat === "vtm") {
    const discEntries = Object.entries(char.disciplines ?? {})
      .filter(([, v]) => v > 0);
    if (discEntries.length > 0) {
      lines.push(divider("Disciplines"));
      lines.push(bgTable(char.disciplines ?? {}));
    }
    const virtEntries = Object.entries(char.virtues ?? {})
      .filter(([, v]) => v > 0);
    if (virtEntries.length > 0) {
      lines.push(divider("Virtues"));
      lines.push(bgTable(char.virtues ?? {}));
    }
    const ritualItems = (char.rituals ?? []).filter(Boolean);
    if (ritualItems.length > 0) {
      lines.push(divider("Rituals"));
      for (let ri = 0; ri < ritualItems.length; ri += 2) {
        const left  = ritualItems[ri];
        const right = ritualItems[ri + 1];
        lines.push(right ? padVisTo(left, COL2_LAYOUT[0][0] + COL2_LAYOUT[0][1]) + right : left);
      }
    }
  }

  // Rites (WtA) -- 2-col list of rite display names (hidden when empty)
  if (char.splat === "wta") {
    const riteSlugs = (char.rites ?? []).filter(Boolean);
    if (riteSlugs.length > 0) {
      const splatDef = SplatRegistry.get("wta");
      const wtaExt = splatDef?.ext as IWtaSplatExt | undefined;
      const rites = wtaExt?.rites;
      const riteItems = riteSlugs.map((s) => rites?.[s.toLowerCase()]?.name ?? s);
      lines.push(divider("Rites"));
      for (let ri = 0; ri < riteItems.length; ri += 2) {
        const left  = riteItems[ri];
        const right = riteItems[ri + 1];
        lines.push(right ? padVisTo(left, COL2_LAYOUT[0][0] + COL2_LAYOUT[0][1]) + right : left);
      }
    }
  }

  // Pools -- three columns: Pools | Renown/Template | Health
  lines.push(divider("Pools"));
  lines.push(...poolsSection(char));

  lines.push(footer());

  // Staff section
  if (isStaff) {
    const statusWord = char.status === "approved"   ? "%cgApproved%cn"
      : char.status === "submitted" ? "%cySubmitted - Pending Review%cn"
      : char.status === "denied"    ? "%crDenied%cn"
      : "%cyDraft%cn";
    lines.push(divider("%crStaff Section%cn"));

    lines.push(`%chStatus:%cn ${statusWord}`);
    if (char.staffNotes)   lines.push(`%chNotes:%cn  ${char.staffNotes}`);
    if (char.approvedBy)   lines.push(`%chApproved:%cn ${char.approvedBy}`);
    if (char.deniedReason) lines.push(`%chDenied:%cn  ${char.deniedReason}`);

    // Stat log -- 2 entries per row
    if (char.statLog.length > 0) {
      lines.push(divider("Stat Log"));
      const entries = char.statLog.slice(-10).map((e) =>
        `%ch${e.trait}%cn: ${JSON.stringify(e.old)}->${JSON.stringify(e.new)} (${e.staffId})`
      );
      for (let i = 0; i < entries.length; i += 2) {
        lines.push(entries[i + 1]
          ? padVisTo(entries[i], COL2_LAYOUT[0][0] + COL2_LAYOUT[0][1]) + entries[i + 1]
          : entries[i]);
      }
    }

    lines.push(footer());
  }

  return lines.join("%r");
}

/** Step budget display -- appended to every +chargen/set response. */
export async function formatBudget(budget: IStepBudget): Promise<string> {
  const statusColor = budget.complete ? "%cg" : "%cy";
  const statusLabel = budget.complete
    ? `${statusColor}COMPLETE%cn`
    : `${statusColor}IN PROGRESS%cn`;

  const lines: string[] = [
    divider(`Step ${budget.step}`),
    `Status: ${statusLabel}`,
  ];

  if (Object.keys(budget.remaining).length > 0) {
    const rem = Object.entries(budget.remaining)
      .map(([k, v]) => {
        const label = k
          .replace(/Dots$/, "")
          .replace(/Needed$/, "")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/^./, (c) => c.toUpperCase());
        return v >= 0
          ? `${label}: %cy${v}%cn remaining`
          : `${label}: %cr${-v}%cn over`;
      })
      .join("  |  ");
    lines.push(rem);
  }

  if (budget.issues.length > 0) {
    const MAX = W - 4; // "  ! " prefix = 4 chars
    lines.push(divider("%ch%crErrors%cn"));
    budget.issues.forEach((issue) => {
      const msg = issue.length > MAX ? issue.slice(0, MAX - 3) + "..." : issue;
      lines.push(`  %ch%cr!%cn %cr${msg}%cn`);
    });
  }

  return lines.join("%r");
}

/**
 * Resolve identity field display values (breed/auspice/tribe) using the splat
 * registry where available. Returns "-" fallback when a field is unset.
 */
function identityNames(char: IWoDChar): { breed: string; auspice: string; tribe: string } {
  const splat = SplatRegistry.get(char.splat);
  const ext   = splat?.ext as IWtaSplatExt | undefined;
  const breedDef   = ext?.breeds?.find((b) => b.id === char.breed);
  const auspiceDef = ext?.auspices?.find((a) => a.id === char.auspice);
  const tribeDef   = ext?.tribes?.find((t) => t.id === char.tribe);
  return {
    breed:   breedDef?.name        ?? char.breed   ?? "-",
    auspice: auspiceDef?.name      ?? char.auspice ?? "-",
    tribe:   tribeDef?.displayName ?? char.tribe   ?? "-",
  };
}

/** VtM: display name for the character's clan. */
function clanDisplay(char: IWoDChar): string {
  if (!char.clan) return "-";
  const ext = SplatRegistry.get("vtm")?.ext as IVtmSplatExt | undefined;
  const def = ext?.clans?.find(
    (c) => c.id === char.clan || c.name.toLowerCase() === char.clan?.toLowerCase(),
  );
  return def?.displayName ?? char.clan;
}

/**
 * Splat-aware dashboard header row -- returns three pre-labelled cells suitable
 * for cols3(). Dispatch off char.splat keeps this future-proof: add a case per
 * new splat rather than expanding a hardcoded "Breed/Auspice/Tribe" row.
 */
function dashboardHeaderCells(char: IWoDChar): [string, string, string] {
  const { breed, auspice, tribe } = identityNames(char);
  const concept  = char.concept  || "-";
  const nature   = char.nature   || "-";
  const demeanor = char.demeanor || "-";

  switch (char.splat) {
    case "wta":
      return [
        `Breed:   ${breed}`,
        `Auspice: ${auspice}`,
        `Tribe:   ${tribe}`,
      ];
    case "kinfolk":
      return [
        `Concept: ${concept}`,
        `Tribe:   ${tribe}`,
        `Nature:  ${nature}`,
      ];
    case "mortal":
    default:
      return [
        `Concept:  ${concept}`,
        `Nature:   ${nature}`,
        `Demeanor: ${demeanor}`,
      ];
  }
}

/** Full progress dashboard (+chargen with no switch). */
export async function formatDashboard(char: IWoDChar): Promise<string> {
  const splat = SplatRegistry.get(char.splat);
  const [c1, c2, c3] = dashboardHeaderCells(char);

  const lines: string[] = [
    header(`CHARGEN - ${splat?.name ?? char.splat}`),
    cols3(c1, c2, c3),
    footer(),
  ];

  const steps = [
    { n: 1, label: "Sub-template"     },
    { n: 2, label: "Concept"          },
    { n: 3, label: "Attributes"       },
    { n: 4, label: "Abilities"        },
    { n: 5, label: "Advantages"       },
    { n: 6, label: "Finishing Touches"},
  ] as const;

  // Layout: "  [~] " (6) + tag (TAG_W) + " " (1) + summary (SUMMARY_W) = 78
  const TAG_W     = 26; // fits "Step 6 - Finishing Touches" exactly
  const SUMMARY_W = W - 6 - TAG_W - 1; // 45

  for (const { n, label } of steps) {
    const budget  = validateStep(char, n);
    const locked  = n > char.chargenStep + 1;
    const rawTag  = `Step ${n} - ${label}`;
    const tag     = rawTag.length > TAG_W
      ? rawTag.slice(0, TAG_W - 3) + "..."
      : rawTag.padEnd(TAG_W);

    if (locked) {
      lines.push(`  %ch[ ]%cn ${tag} %cy(locked)%cn`);
    } else if (budget.complete) {
      lines.push(`  %ch%cg[X]%cn ${tag} %cgComplete%cn`);
    } else {
      const raw     = progressSummary(budget);
      const summary = raw.length > SUMMARY_W ? raw.slice(0, SUMMARY_W - 3) + "..." : raw;
      lines.push(`  %ch[~]%cn ${tag} %cy${summary}%cn`);
    }
  }

  lines.push(footer());
  lines.push("Use %ch+chargen/set <trait>=<value>%cn to fill in traits.");

  // Notes summary -- just show what's set, no requirements
  lines.push(divider(null));
  if (char.notes && char.notes.length > 0) {
    lines.push("%chNotes:%cn");
    for (const n of char.notes) {
      const vis = n.isPublic ? "%cg(public)%cn" : "(private)";
      lines.push(`  ${n.name.padEnd(20)} ${vis}`);
    }
  } else {
    lines.push("%chNotes:%cn  none set  -- use %ch+notes/set <name>=<text>%cn to add");
  }

  return lines.join("%r");
}

/** Gift pool list for +chargen/giftlist [breed|auspice|tribe] [rank]. */
export async function formatGiftList(char: IWoDChar, pool?: string, rank?: number): Promise<string> {
  const splat = SplatRegistry.get(char.splat);
  const ext   = splat?.ext as IWtaSplatExt | undefined;
  if (!ext?.gifts) return "No gifts available for this splat.";

  const rankLabel = rank ? ` -- Rank ${rank}` : "";
  const lines: string[] = [header(`Gift List${rankLabel}`)];

  // Build the list of pools to display
  const KNOWN = ["breed", "auspice", "tribe"];
  const pools: Array<{ id: string; label: string }> = [];
  if (!pool || pool === "breed")   { if (char.breed)   pools.push({ id: char.breed,   label: `Breed (${char.breed})`   }); }
  if (!pool || pool === "auspice") { if (char.auspice) pools.push({ id: char.auspice, label: `Auspice (${char.auspice})` }); }
  if (!pool || pool === "tribe")   { if (char.tribe)   pools.push({ id: char.tribe,   label: `Tribe (${char.tribe})`   }); }
  if (pool && !KNOWN.includes(pool)) pools.push({ id: pool, label: pool });

  if (pools.length === 0) {
    lines.push("  No pools to display.");
    lines.push(footer());
    return lines.join("%r");
  }

  const giftsByPool = pools.map(({ id, label }) => ({
    label,
    gifts: Object.values(ext.gifts)
      .filter((g) => g.source.includes(id) && (rank === undefined || g.level === rank))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  // Each pool stacks vertically; gifts within each pool spread across 3 columns.
  for (let p = 0; p < giftsByPool.length; p++) {
    const { label, gifts } = giftsByPool[p];
    if (p > 0) lines.push("");
    lines.push(divider(label));
    if (gifts.length === 0) {
      lines.push("  (none)");
    } else {
      for (let r = 0; r < gifts.length; r += 3) {
        let line = "";
        for (let c = 0; c < 3; c++) {
          const [cw, trail] = COL_LAYOUT[c];
          const name = gifts[r + c]?.name ?? "";
          const cell = name.length > cw ? name.slice(0, cw - 3) + "..." : name;
          line += c < 2 ? padVisTo(cell, cw + trail) : cell;
        }
        lines.push(line.trimEnd());
      }
    }
  }

  lines.push(footer());
  return lines.join("%r");
}

/** Staff queue listing for +chargen/queue. */
export async function formatQueue(chars: IWoDChar[]): Promise<string> {
  if (chars.length === 0) return "%chNo characters pending review.%cn";
  const hdr = `${"Player".padEnd(20)} ${"Splat".padEnd(8)} ${"Auspice".padEnd(12)} Tribe`;
  const lines: string[] = [
    header("Pending Character Applications"),
    `  ${hdr}`,
    `  ${"-".repeat(W - 2)}`,
  ];
  chars.forEach((c) => {
    const splat    = SplatRegistry.get(c.splat);
    const ext      = splat?.ext as IWtaSplatExt | undefined;
    const tribe    = ext?.tribes?.find((t) => t.id === c.tribe)?.displayName ?? c.tribe ?? "-";
    const auspice  = ext?.auspices?.find((a) => a.id === c.auspice)?.name   ?? c.auspice ?? "-";
    lines.push(`  ${c.playerId.padEnd(20)} ${c.splat.padEnd(8)} ${auspice.padEnd(12)} ${tribe}`);
  });
  return lines.join("%r");
}

/** Render all three rule styles for visual preview. */
export async function formatRulesPreview(): Promise<string> {
  return [
    header("Page Header (header)"),
    divider("Section Divider (divider)"),
    footer(),
  ].join("%r");
}

/**
 * Format a dice roll as two lines:
 *   pub  -- shown to the room: no individual dice, just the result.
 *   priv -- shown to the roller: includes pool values and each die.
 */
export function formatRoll(
  roll: IDiceRoll,
  resolution: { pubLabel: string; privLabel: string },
  rollerName: string,
): { pub: string; priv: string } {
  const prefix = `%ch%cyRoll>%cn`;
  const diff   = `vs %ch${roll.difficulty}%cn`;
  const spec   = roll.specialty ? " (spec)" : "";

  // Result tag
  let result: string;
  if (roll.botch) {
    result = `%ch%crBotch!%cn`;
  } else if (roll.netSuccesses === 0) {
    result = `%cyFailure%cn`;
  } else {
    const tag = roll.exceptional ? "%ch%cgExceptional! %cn" : "";
    result = `${tag}%cg${roll.netSuccesses} Success(es)%cn`;
  }

  // Dice string for private view -- colored per outcome
  const diceStr = "(" + roll.dice.map((d) => {
    if (d === 1)              return `%cr${d}%cn`;
    if (d >= roll.difficulty) return d === 10 ? `%ch%cg${d}%cn` : `%cg${d}%cn`;
    return String(d);
  }).join(" ") + ")";

  const pub  = `${prefix} ${rollerName} rolls %ch${resolution.pubLabel}%cn ${diff}${spec} => ${result}.`;
  const priv = `${prefix} ${rollerName} rolls %ch${resolution.privLabel}%cn ${diff}${spec} => ${diceStr} ${result}.`;

  return { pub, priv };
}

/** Color a damage type label for display. */
function colorDamageType(type: DamageMark): string {
  if (type === "B") return `%cy`;
  if (type === "L") return `%cr`;
  if (type === "A") return `%ch%cr`;
  return "";
}

/** Render a full health track as colored bracketed cells. */
export function coloredTrack(track: DamageMark[]): string {
  return track.map((m) => {
    if (m === "B") return `%cy[/]%cn`;
    if (m === "L") return `%cr[X]%cn`;
    if (m === "A") return `%ch%cr[*]%cn`;
    return `[ ]`;
  }).join(" ");
}

/**
 * Format a +hurt result line.
 *   actorName -- who applied the damage (may equal targetName for self)
 *   targetName -- who received it
 */
export function formatHurt(
  actorName: string,
  targetName: string,
  amount: number,
  type: DamageMark,
  track: DamageMark[],
  overflow: number,
  overflowLabel = "Incapacitated",
  incapLabel = "Incapacitated",
): string {
  const prefix   = `%ch%crHurt>%cn`;
  const typeCol  = colorDamageType(type);
  const typeName = type === "B" ? "bashing" : type === "L" ? "lethal" : "aggravated";
  const who      = actorName === targetName
    ? `%ch${targetName}%cn takes`
    : `%ch${actorName}%cn hurts %ch${targetName}%cn --`;

  let stateNote = "";
  if (overflow > 0) {
    stateNote = ` %ch%cr-- ${overflowLabel}!%cn`;
  } else if (track.every((m) => m !== "")) {
    // Track fully filled -- bashing-only = unconscious, any lethal/agg = splat label
    const worst = track[0]; // heaviest is always at index 0 after compact
    stateNote = worst === "B"
      ? ` %ch%cy-- Unconscious!%cn`
      : ` %ch%cr-- ${incapLabel}!%cn`;
  }

  return `${prefix} ${who} %ch${amount}%cn ${typeCol}${typeName}%cn damage.${stateNote}%r  ${coloredTrack(track)}`;
}

/**
 * Format a +heal result line.
 *   actorName -- who triggered the heal (may equal targetName)
 *   targetName -- who was healed
 *   typeLabel  -- "bashing" / "lethal" / "aggravated" / "" (for "all")
 */
export function formatHeal(
  actorName: string,
  targetName: string,
  healed: number,
  type: DamageMark | "all",
  track: DamageMark[],
): string {
  const prefix   = `%ch%cgHeal>%cn`;
  const typeName = type === "all" ? "" : (type === "B" ? "bashing " : type === "L" ? "lethal " : "aggravated ");
  const typeCol  = type === "all" ? "" : colorDamageType(type);
  const who      = actorName === targetName
    ? `%ch${targetName}%cn heals`
    : `%ch${actorName}%cn heals %ch${targetName}%cn --`;
  return `${prefix} ${who} %ch${healed}%cn ${typeCol}${typeName}%cndamage.%r  ${coloredTrack(track)}`;
}

// -- Internal helpers -------------------------------------------------------

/** Visual length: length after stripping MUSH codes. */
function vlen(s: string): number {
  return s.replace(/%c[a-zA-Z]/g, "").replace(/%[rntbR]/g, "").length;
}

/**
 * Two equal columns, padding based on visual (code-stripped) length.
 * Each column is W/2 = 39 chars wide.
 */
function cols2(left: string, right: string): string {
  const half = Math.floor(W / 2);
  return left + " ".repeat(Math.max(1, half - vlen(left))) + right;
}

/**
 * Three equal columns, padding based on visual (code-stripped) length.
 * Each column is W/3 = 26 chars wide.
 */
function cols3(a: string, b: string, c: string): string {
  const col = Math.floor(W / 3);
  const padA = Math.max(0, col - vlen(a));
  const padB = Math.max(0, col - vlen(b));
  return a + " ".repeat(padA) + b + " ".repeat(padB) + c;
}

/**
 * Format a single trait cell content (no trailing spaces).
 * Shows "perm(temp)" only when they differ.
 */
function fmtCell(name: string, perm: number, temp: number | undefined, contentWidth: number): string {
  const valStr = (temp !== undefined && temp !== perm)
    ? `${perm}(${temp})`
    : `${perm}`;
  const dots = Math.max(1, contentWidth - name.length - valStr.length);
  return `%ch${name}%cn` + ".".repeat(dots) + `%ch${valStr}%cn`;
}

/** Pad a string (which may contain MUSH codes) to `width` visual chars. */
function padVisTo(s: string, width: number): string {
  return s + " ".repeat(Math.max(0, width - vlen(s)));
}

/** Center a string within exactly `width` visual chars (pads both sides). */
function centerInCol(s: string, width: number): string {
  const len = vlen(s);
  const left  = Math.max(0, Math.floor((width - len) / 2));
  const right = Math.max(0, width - len - left);
  return " ".repeat(left) + s + " ".repeat(right);
}

/**
 * Three-column trait table.
 * Each column is exactly COL (26) chars wide; total = W (78).
 * Specialty footnotes are appended after all trait rows.
 */
function traitTable(
  labels: [string, string, string],
  groups: [string[], string[], string[]],
  values: Record<string, number>,
  temps: Record<string, number> | undefined,
  specialties: Record<string, string>,
  base: number,
): string {
  // Header row -- each label centered within its column's total width
  const hdr = labels.map((l, i) => {
    const [cw, trail] = COL_LAYOUT[i];
    const total = cw + trail;
    const raw = `%ch${l}%cn`;
    const cell = centerInCol(raw, total);
    return i < 2 ? cell : cell.trimEnd(); // strip trailing on last col
  }).join("");

  const maxLen = Math.max(groups[0].length, groups[1].length, groups[2].length);
  const rows: string[] = [hdr];

  for (let i = 0; i < maxLen; i++) {
    let line = "";
    for (let c = 0; c < 3; c++) {
      const [cw, trail] = COL_LAYOUT[c];
      const trait = groups[c][i];
      if (!trait) {
        if (c < 2) line += " ".repeat(cw + trail); // blank cell, keep alignment
        continue;
      }
      const perm = base + (values[trait] ?? 0);
      const temp = temps?.[trait];
      line += fmtCell(trait, perm, temp, cw) + " ".repeat(trail);
    }
    rows.push(line);
  }

  return rows.join("%r");
}

/**
 * Two-column specialties table.
 * Each cell: "Specialty (Stat)", laid out in two columns with padding.
 */
function specialtiesTable(entries: [string, string][]): string[] {
  const [cw0, tr0] = COL2_LAYOUT[0];
  const [cw1]      = COL2_LAYOUT[1];
  const rows: string[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const [stat0, spec0] = entries[i];
    const left  = `${spec0} (${stat0})`;
    const right = entries[i + 1] ? `${entries[i + 1][1]} (${entries[i + 1][0]})` : "";
    rows.push(padVisTo(left, cw0 + tr0) + right);
  }
  return rows;
}

/**
 * Two-column merit/flaw table.
 * Left column: Merits (with dot-fill values).
 * Right column: Flaws (with dot-fill values).
 * Rows zip the two lists together; shorter list leaves its cells blank.
 */
function meritsFlawsTable(merits: Record<string, number>, flaws: Record<string, number>): string[] {
  const mEntries = Object.entries(merits).filter(([, v]) => v > 0);
  const fEntries = Object.entries(flaws).filter(([, v]) => v > 0);

  const [cw0, tr0] = COL2_LAYOUT[0];
  const [cw1]      = COL2_LAYOUT[1];

  // Column headers -- centered within each column, matching traitTable style
  const hdr = centerInCol(`%chMerits%cn`, cw0 + tr0) + centerInCol(`%chFlaws%cn`, cw1).trimEnd();

  const nRows = Math.max(mEntries.length, fEntries.length);
  if (nRows === 0) return [hdr];

  const rows: string[] = [hdr];
  for (let i = 0; i < nRows; i++) {
    const left  = mEntries[i] ? fmtCell(mEntries[i][0], mEntries[i][1], undefined, cw0) : "";
    const right = fEntries[i] ? fmtCell(fEntries[i][0], fEntries[i][1], undefined, cw1) : "";
    rows.push(padVisTo(left, cw0 + tr0) + right);
  }
  return rows;
}

/**
 * Two-column dot-fill table for Backgrounds.
 * Each entry: name + dot-fill + value, laid out in two columns.
 */
function bgTable(backgrounds: Record<string, number>): string {
  const entries = Object.entries(backgrounds).filter(([, v]) => v > 0);
  if (entries.length === 0) return "  None";
  const rows: string[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const [n0, v0] = entries[i];
    let line = fmtCell(n0, v0, undefined, COL2_LAYOUT[0][0]) + " ".repeat(COL2_LAYOUT[0][1]);
    if (entries[i + 1]) {
      const [n1, v1] = entries[i + 1];
      line += fmtCell(n1, v1, undefined, COL2_LAYOUT[1][0]);
    }
    rows.push(line);
  }
  return rows.join("%r");
}

/**
 * Wrap a list of short items into lines of at most `width` chars,
 * with `indent` prefix, items separated by "  ".
 */
function wrapItems(items: string[], width: number, indent: string): string[] {
  const lines: string[] = [];
  let line = indent;
  for (const item of items) {
    const candidate = line.length === indent.length ? item : `  ${item}`;
    if (line.length + candidate.length > width && line.length > indent.length) {
      lines.push(line);
      line = indent + item;
    } else {
      line += candidate;
    }
  }
  if (line.length > indent.length) lines.push(line);
  return lines;
}

/**
 * Build one health-track display cell: "Bruised.........[ ]" fitting in `width` chars.
 * Damage markers are MUSH-colored.
 */
function fmtHealthCell(level: string, mark: DamageMark, width: number): string {
  const raw  = markChar(mark);
  const cell = raw === "/" ? "%cy[/]%cn" : raw === "X" ? "%cr[X]%cn" : raw === "*" ? "%cr%ch[*]%cn" : "[ ]";
  const dots = Math.max(1, width - level.length - 3); // 3 = visual len of "[X]"
  return `%ch${level}%cn` + ".".repeat(dots) + cell;
}

/** Seven health-track rows, each fitting in COL_LAYOUT[2][0] (26) chars. */
function healthTrackLines(char: IWoDChar): string[] {
  const track = char.healthTrack ?? (Array<DamageMark>(HEALTH_TRACK_SIZE).fill(""));
  return HEALTH_LEVELS.map((level, i) =>
    fmtHealthCell(level, track[i] ?? "", COL_LAYOUT[2][0])
  );
}

/**
 * Three-column pools section lines.
 * Col 1: Rage / Gnosis / Willpower (or just Willpower for non-WtA)
 * Col 2: Renown (WtA only) or empty
 * Col 3: Health track (7 rows)
 */
function poolsSection(char: IWoDChar): string[] {
  const poolCol: string[] = [];
  if (char.splat === "wta") {
    if (isFrenzied(char)) {
      const label = char.frenzyState === "fox" ? "FOX" : "BERSERK";
      poolCol.push(`%cr[FRENZIED: ${label}] %cy${frenzyRemaining(char)}%cn`);
    }
    poolCol.push(fmtCell("Rage",      char.rage ?? 0,     char.rageCurrent,      COL_LAYOUT[0][0]));
    poolCol.push(fmtCell("Gnosis",    char.gnosis ?? 0,   char.gnosisCurrent,    COL_LAYOUT[0][0]));
    poolCol.push(fmtCell("Willpower", char.willpower,      char.willpowerCurrent, COL_LAYOUT[0][0]));
    poolCol.push(char.inUmbra
      ? `Location: %ch%cm<Umbra>%cn`
      : `Location: %chMaterial%cn`);
    const wp = woundPenalty(char);
    if (wp > 0) poolCol.push(`%cyWound penalty: -${wp}%cn`);
    poolCol.push(`%cgRegen: 1 Bashing/turn%cn`);
  } else if (char.splat === "kinfolk") {
    if (char.gnosis) poolCol.push(fmtCell("Gnosis",    char.gnosis, char.gnosisCurrent, COL_LAYOUT[0][0]));
    poolCol.push(fmtCell("Willpower", char.willpower, char.willpowerCurrent, COL_LAYOUT[0][0]));
    const wp = woundPenalty(char);
    if (wp > 0) poolCol.push(`%cyWound penalty: -${wp}%cn`);
  } else if (char.splat === "vtm") {
    if (isFrenzied(char)) {
      const label = char.frenzyState === "fox" ? "ROTSCHRECK" : "FRENZY";
      poolCol.push(`%cr[${label}]%cn`);
    }
    poolCol.push(fmtCell("Blood",     char.bloodMax ?? 0, char.bloodPool,    COL_LAYOUT[0][0]));
    poolCol.push(fmtCell("Willpower", char.willpower,     char.willpowerCurrent, COL_LAYOUT[0][0]));
    poolCol.push(fmtCell("Humanity",  char.humanity ?? 7, undefined,         COL_LAYOUT[0][0]));
    const wp = woundPenalty(char);
    if (wp > 0) poolCol.push(`%cyWound penalty: -${wp}%cn`);
    if (char.inTorpor) poolCol.push(`%crIn Torpor%cn`);
  } else {
    poolCol.push(fmtCell("Willpower", char.willpower, char.willpowerCurrent, COL_LAYOUT[0][0]));
    const wp = woundPenalty(char);
    if (wp > 0) poolCol.push(`%cyWound penalty: -${wp}%cn`);
  }

  const renownCol: string[] = [];
  if (char.splat === "wta") {
    const perm = char.renown ?? { glory: 0, honor: 0, wisdom: 0 };
    const temp = char.renownTemp ?? { glory: 0, honor: 0, wisdom: 0 };
    const rank = char.rank ?? 1;
    const rankName = RANK_NAMES[rank] ?? "";
    renownCol.push(`%chRank:%cn ${rank} (${rankName})`);
    const fmtRen = (name: string, t: number, p: number) => {
      const valStr = `${t}+${p}`;
      const dots = Math.max(1, COL_LAYOUT[1][0] - name.length - valStr.length);
      return `%ch${name}%cn` + ".".repeat(dots) + `%ch${valStr}%cn`;
    };
    renownCol.push(fmtRen("Glory",  temp.glory,  perm.glory));
    renownCol.push(fmtRen("Honor",  temp.honor,  perm.honor));
    renownCol.push(fmtRen("Wisdom", temp.wisdom, perm.wisdom));
    if (rank < 5 && normaliseAuspice(char.auspice)) {
      const req = nextRankRequirement(char);
      const shortG = req.have.glory  < req.needed.glory;
      const shortH = req.have.honor  < req.needed.honor;
      const shortW = req.have.wisdom < req.needed.wisdom;
      if (shortG || shortH || shortW) {
        renownCol.push(`%cyNext: G ${req.have.glory}/${req.needed.glory}` +
          ` H ${req.have.honor}/${req.needed.honor}` +
          ` W ${req.have.wisdom}/${req.needed.wisdom}%cn`);
      }
    }
  }

  const healthCol = healthTrackLines(char);
  const nRows = Math.max(poolCol.length, renownCol.length, healthCol.length);

  const rows: string[] = [];
  for (let i = 0; i < nRows; i++) {
    const c1 = poolCol[i]   ?? "";
    const c2 = renownCol[i] ?? "";
    const c3 = healthCol[i] ?? "";
    rows.push(
      padVisTo(c1, COL_LAYOUT[0][0] + COL_LAYOUT[0][1]) +
      padVisTo(c2, COL_LAYOUT[1][0] + COL_LAYOUT[1][1]) +
      c3,
    );
  }

  return rows;
}

function progressSummary(budget: IStepBudget): string {
  const issue = budget.issues[0] ?? "";

  // Validator issues already embed the command after a colon -- strip the prose prefix.
  const cmdIdx = issue.indexOf("+chargen/");
  if (cmdIdx !== -1) return issue.slice(cmdIdx);

  // Map common bare issues to actionable commands.
  if (/concept.*required/i.test(issue))   return "+chargen/set concept=<your concept>";
  if (/breed.*required/i.test(issue))     return "+chargen/set breed=homid|lupus|metis";
  if (/auspice.*required/i.test(issue))   return "+chargen/set auspice=ahroun";
  if (/tribe.*required/i.test(issue))     return "+chargen/set tribe=<tribe>";
  if (/deformity/i.test(issue))           return "+chargen/set deformity=<description>";
  if (/background/i.test(issue))          return "+chargen/set <background>=<dots>";
  if (/renown/i.test(issue))              return "+chargen/set renown=glory/honor/wisdom";
  if (/gift/i.test(issue))               return "+chargen/set gift1=<gift>  (see +chargen/giftlist)";
  if (/freebie/i.test(issue))            return "+chargen/set <trait>=<dots>  (freebies)";

  // Remaining dots -- show a generic command with the group name.
  for (const [key, rem] of Object.entries(budget.remaining)) {
    if (rem > 0) return `+chargen/set <${key.replace("Dots", "")} trait>=<dots>`;
  }

  return issue || "+chargen";
}
