@EXITTYPE

Set the **TYPE** attribute on an exit. The `look` command groups exits into
sections by their TYPE attribute, sorted alphabetically.

SYNTAX
  @exittype <exit>=<value>

EXAMPLES
  @exittype north=direction       Tag the north exit as a direction.
  @exittype Inn=tavern            Tag the Inn exit as type "tavern".
  @exittype "Secret Hatch"=hidden Tag a multi-word exit.
  @exittype north=                Clear the TYPE attribute.

NOTES
  Equivalent to `&type <exit>=<value>`. Both write to the same attribute.
  Untagged exits with cardinal names (n, s, e, w, up, down, ...) auto-
  classify as "direction"; everything else defaults to "exit".

SEE ALSO: look, &type
