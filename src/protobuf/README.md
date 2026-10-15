# OpenSearch Protobuf schema

`opensearch-1.2.0.proto` is an unmodified copy of `protos/schemas/common.proto`
from [OpenSearch Protobufs 1.2.0](https://github.com/opensearch-project/opensearch-protobufs/tree/1.2.0),
licensed under Apache-2.0 (see LICENSE.txt). The schema is bundled locally; cells
never download executable definitions at runtime. Google's `Struct` dependency
is provided by protobufjs.

SPDX metadata is in `opensearch-1.2.0.proto.license` so the upstream schema remains
byte-for-byte unchanged. Keep that sidecar and the upstream LICENSE/NOTICE files
when updating the schema.

The gRPC method paths follow the same release's `protos/services/search_service.proto`
and `document_service.proto`. When updating the schema, also update the version
shown in the cell, examples, and the transport integration tests.
