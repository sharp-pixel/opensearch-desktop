# Field-name autocomplete

Query DSL and PPL editors suggest fields from the mappings of the selected index or index pattern. Use the suggestion menu while typing, or press Ctrl+Space; press Tab to insert a suggestion.

- DSL uses the index in the request endpoint. Suggestions appear in field positions such as `match`, `term`, `range`, aggregation `field` values, sorting, `_source`, and multi-match field lists. Nested `path` values suggest nested fields.
- PPL uses the leading `source=` clause. Suggestions include object paths and multi-fields such as `user.name` and `message.keyword`; identifiers are quoted when needed.
- Investigation PPL merges fields from the selected connections. Field details retain conflicting mapping types across indexes or clusters.

Mapping requests use the selected connection's authentication and transport. The account must be able to read mappings. If a request fails or access is denied, built-in language suggestions remain available.

Mappings are loaded on demand and cached per connection and index target for 60 seconds. Failed lookups retry on the next completion request after five seconds. Changing a connection or index target uses its own mappings; late responses for the previous context are discarded. Requests only read metadata and do not run the query.
