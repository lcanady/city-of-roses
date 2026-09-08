LOOK

Examine the current room or an object in Rhost-style layout.

SYNTAX
  look                Show the current room.
  look <object>       Show a specific object, exit, or player.

EXAMPLES
  look                See your current location.
  look Alice          See Alice's description.

NOTES
  Room display is 78 cols with a centered "=====" header showing the
  room name (plus grid_area in cyan if set). Players row shows name
  (@moniker rendered verbatim), a role-tag column for staff
  (Wizard/Root/Admin/Staff, from theme.look.roleTags), color-coded
  idle time, and &short-desc.

  Exits group into sections by their TYPE attribute — set with
  &type <exit>=<value> (or @exittype). Cardinal exits auto-classify as
  "direction"; others default to "exit". Sections render alphabetically
  in 3 columns. Each exit shows "<alias> Name" using the FIRST declared
  alias from the name;alias list.

SEE ALSO: help score, help inventory, help examine, help @exittype
