# gRPC notebook cells

Add a **gRPC** cell to call OpenSearch's `SearchService/Search` (including supported
k-NN queries) or `DocumentService/Bulk`. Requests are edited as JSON, validated
against the bundled **OpenSearch Protobuf 1.2.0** schema, and sent as binary
Protobuf over native HTTP/2 gRPC. Results show the gRPC status and decoded response.

1. Enable OpenSearch's gRPC transport. See the [official setup instructions](https://docs.opensearch.org/latest/api-reference/grpc-apis/).
2. In connection settings, **gRPC endpoint** defaults to `http://localhost:9400`,
   matching this repository's plaintext Docker `transport-grpc` configuration.
   The second cluster uses `http://localhost:9401`. Both gRPC ports are published
   only on the host's loopback interface. Saved endpoints are kept; change an existing
   `https://localhost:9400` endpoint to HTTP for this local Docker setup.
   For a cluster configured with TLS, use `https://` and a trusted server certificate
   valid for the endpoint hostname. The REST localhost certificate exception does
   not apply to gRPC.
3. Add a gRPC cell, select Search or Bulk, and use **Load example** to get started.
   Run with the play button or Ctrl/Cmd+Enter.

Use Protobuf field names (`snake_case`), with search queries nested under
`search_request_body`. Bytes, including Bulk document bodies and response
`x_source`, are Base64 strings. 64-bit response integers are displayed as strings
to preserve precision. The Bulk example's `object` decodes to
`{"title":"Hello OpenSearch"}`. Changing the method preserves the request text;
loading an example asks before replacing existing content.

Electron and Tauri support native gRPC. `npm run dev` supplies a same-origin
local gRPC bridge for browser development. Static web deployments do not include
that bridge. Basic and API-key authentication use the selected connection's
credentials; IAM/SigV4, client certificates, custom schema uploads, and streaming
methods are not supported. Requests have a 30-second deadline and a 10 MiB message
limit. Notebook save/import/export preserves gRPC cells and results.
