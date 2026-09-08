+NOTES

  Write and manage character notes (background, personality, hooks).

SYNTAX
  +notes                          List your notes.
  +notes <name>                   Read a named note.
  +notes/set <name>=<text>        Create or replace a note.
  +notes/del <name>               Delete a note.
  +notes/public <name>            Make a note visible on +sheet.
  +notes/private <name>           Make a note staff-only (default).

  Notes are private by default. Staff can always read all notes.

EXAMPLES
  +notes/set bg=Born in the bayou.
  +notes background
  +notes/public bg
  +notes/del goals

SEE ALSO: +help chargen, +help chargen
