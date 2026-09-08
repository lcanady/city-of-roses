+FINGER

MUSH-style profile card for a character. Shows status, idle, full name,
and the default + custom profile fields.

SYNTAX
  +finger [<player>]            Show your own or another character's card.
  +finger/set <field>=<value>   Set a profile field on yourself.
  +finger/set <field>=          Clear a profile field.
  +finger/set <field>=@@        Keep the value but hide it from display.
  +finger/set <field>           Show the field's current value.

SWITCHES
  /set       Set, clear, hide, or inspect a single field on yourself.

EXAMPLES
  +finger                       Your own profile.
  +finger Alice                 Look up Alice (also matches alias).
  +finger/set pronouns=she/her  Set the Pronouns field.
  +finger/set position=         Clear Position.
  +finger/set quote=@@          Hide Quote from display.

SEE ALSO: +gname, +staff, +where
