// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

const { executeGrpc } = require('../../shared/node/grpc.cjs');

// Browser fetch cannot speak native HTTP/2 gRPC. Expose a local, same-origin
// development bridge; this route is not part of the static production bundle.
function grpcBridge() {
  return {
    name: 'opensearch-grpc-bridge',
    configureServer(server) {
      server.middlewares.use('/__grpc', async (req, res) => {
        const origin = req.headers.origin;
        if (req.method !== 'POST' || !origin || origin !== `http://${req.headers.host}` ||
            req.headers['content-type'] !== 'application/json' || req.headers['x-workbench-grpc'] !== '1') {
          res.writeHead(403).end();
          return;
        }
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 15 * 1024 * 1024) { res.writeHead(413).end(); return; }
            chunks.push(chunk);
          }
          const controller = new AbortController();
          const abort = () => controller.abort();
          res.once('close', abort);
          const result = await executeGrpc(JSON.parse(Buffer.concat(chunks).toString('utf8')), controller.signal)
            .finally(() => res.removeListener('close', abort));
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}
module.exports = { grpcBridge };
