EXAMINE

Inspect an object's full metadata.

SYNTAX
  examine                 Examine yourself.
  examine <object>        Examine an object, room, or player.

EXAMPLES
  examine me
  examine here
  examine box

NOTES
  78-col bordered output. Shows Flags, Owner, Lock, Location (with
  dbref), Home, and channel memberships (alias + on/off state), then
  a Description block, then all non-system attributes with values
  uppercased.

  If the target has players in its contents, a "Characters" section
  lists them.

  You must own the target OR it must carry the VISUAL flag. The
  password attribute is never shown.

SEE ALSO: help look, help @set, help @describe
