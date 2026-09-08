EQ -- @eq/<field> <item>=<value>

  Thin wrapper for setting per-item attributes the system reads:
  mechanical stats (damage, weapon type, etc.) AND display attrs (name,
  desc, verbs fired on use). Each call sets one field.

  You must be able to edit the item (own it, or have staff perms) for
  any @eq call to succeed. "Permission denied." means you don't.

SYNTAX
  @eq/<field> <item>=<value>           Set one field.
  @eq/clear <item>                     Wipe all mechanical eq fields.
  @eq/copy <item>=<template>           Save an item's eq definition.
  @eq/give <item>=<template>           Apply a template to an existing item.
  @eq/new <template>=<name>            Spawn a brand-new item from a template.
  @eq/template                         List stored templates.
  @eq/template <name>                  Show a template's fields.
  @eq/template delete <name>           Delete a template.

TEMPLATES
  Build a weapon once, then @eq/copy it into a named template and use
  @eq/new to spawn fresh copies into your inventory, or @eq/give to
  stamp the fields onto an existing item. Static eq fields, name, desc,
  and verb attrs are stored. Live-state flags (worn, wielded, concealed,
  fetishActive, talenSpent) are NOT copied -- those belong to the
  individual holder.

MECHANICAL FIELDS  (aliases in parens)
  kind                  weapon|armor|shield|fetish|tool|misc
  weaponType  /wt /type brawl|melee|firearms|thrown
  damage                non-negative integer
  damageType  /dt       B|L|A
  silver                true|false
  fetish                true|false
  fetishCost  /fcost    non-negative integer (Gnosis)
  fetishDesc  /fdesc    free text (+fetish/info)
  fetishActive          true|false (live-state; set by +fetish/use)
  armorRating /armor    non-negative integer
  concealability /con   P|J|T|N

DISPLAY + VERB ATTRS
  name                  Item name. e.g. Edge-Lord's Kiss.
  desc                  Description (same as @desc).
  succ / osucc          User / room message on a successful use.
  fail / ofail          User / room message on a failed use.
  use  / ouse           User / room message when invoked.

EXAMPLES
  @eq/kind silver klaive=weapon
  @eq/wt silver klaive=melee
  @eq/damage silver klaive=4
  @eq/name silver klaive=Edge-Lord's Kiss
  @eq/desc silver klaive=A klaive of iron and silver that hums.
  @eq/succ silver klaive=The blade sings its hunger back to you.
  @eq/osucc silver klaive='s klaive hums with an answering note.
  @eq/clear sword
  @eq/copy silver klaive=silver-klaive
  @eq/new silver-klaive=another silver klaive
  @eq/give loot sword=silver-klaive
  @eq/template

SEE ALSO: +help wear, +help wield, +help fetish, +help wod20th
