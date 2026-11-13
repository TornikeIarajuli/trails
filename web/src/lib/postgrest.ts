// Builds the value for a PostgREST `or=(...)` filter that matches `term` as a
// case-insensitive substring of any of `columns`. The term is user input: LIKE wildcards are
// escaped so they match literally, and the value is double-quoted so characters that are
// syntax in a filter (comma, dot, parentheses, quotes) cannot break out of it.
export function ilikeAny(columns: string[], term: string): string {
  const pattern = term.replace(/[\\%_]/g, "\\$&");
  const quoted = `"%${pattern.replace(/[\\"]/g, "\\$&")}%"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(",");
}
