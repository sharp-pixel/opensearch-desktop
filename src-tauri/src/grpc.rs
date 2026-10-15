// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

use base64::{engine::general_purpose::STANDARD, Engine};
use bytes::{Buf, BufMut, Bytes};
use std::error::Error;
use serde::{Deserialize, Serialize};
use tonic::{
    codec::{Codec, DecodeBuf, Decoder, EncodeBuf, Encoder},
    transport::{ClientTlsConfig, Endpoint},
    Request, Status,
};

#[derive(Deserialize)]
pub struct GrpcRequest {
    #[serde(rename = "requestId")]
    request_id: Option<String>,
    endpoint: String,
    method: String,
    payload: String,
    authorization: Option<String>,
}

#[derive(Serialize)]
pub struct GrpcResponse {
    code: i32,
    payload: Option<String>,
    error: Option<String>,
}

// Encoding/decoding uses the bundled OpenSearch schema in the renderer. Tonic
// owns HTTP/2 framing, deadlines, trailers, and transport status handling.
#[derive(Default)]
struct RawCodec;
struct RawEncoder;
struct RawDecoder;
impl Codec for RawCodec {
    type Encode = Bytes;
    type Decode = Bytes;
    type Encoder = RawEncoder;
    type Decoder = RawDecoder;
    fn encoder(&mut self) -> RawEncoder {
        RawEncoder
    }
    fn decoder(&mut self) -> RawDecoder {
        RawDecoder
    }
}
impl Encoder for RawEncoder {
    type Item = Bytes;
    type Error = Status;
    fn encode(&mut self, item: Bytes, dst: &mut EncodeBuf<'_>) -> Result<(), Status> {
        dst.put(item);
        Ok(())
    }
}
impl Decoder for RawDecoder {
    type Item = Bytes;
    type Error = Status;
    fn decode(&mut self, src: &mut DecodeBuf<'_>) -> Result<Option<Bytes>, Status> {
        Ok(Some(src.copy_to_bytes(src.remaining())))
    }
}

#[tauri::command]
pub async fn grpc_execute(request: GrpcRequest) -> Result<GrpcResponse, String> {
    crate::requests::run(request.request_id.clone(), execute_inner(request)).await?
}

fn transport_error(error: tonic::transport::Error) -> Status {
    let mut message = error.to_string();
    let mut source = error.source();
    while let Some(cause) = source {
        message.push_str(": ");
        message.push_str(&cause.to_string());
        source = cause.source();
    }
    Status::unavailable(message)
}

async fn execute_inner(request: GrpcRequest) -> Result<GrpcResponse, String> {
    let path = match request.method.as_str() {
        "Search" => "/org.opensearch.protobufs.services.SearchService/Search",
        "Bulk" => "/org.opensearch.protobufs.services.DocumentService/Bulk",
        _ => return Err("Unsupported gRPC method".into()),
    };
    let url = reqwest::Url::parse(&request.endpoint).map_err(|e| e.to_string())?;
    if !["http", "https"].contains(&url.scheme())
        || !url.username().is_empty()
        || url.password().is_some()
        || url.path() != "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("gRPC endpoint must be an http:// or https:// origin".into());
    }
    const LIMIT: usize = 10 * 1024 * 1024;
    if request.payload.len() > LIMIT.div_ceil(3) * 4 {
        return Err("Protobuf request exceeds 10 MiB".into());
    }
    let payload = STANDARD
        .decode(&request.payload)
        .map_err(|e| e.to_string())?;
    if payload.len() > LIMIT {
        return Err("Protobuf request exceeds 10 MiB".into());
    }
    let mut endpoint = Endpoint::from_shared(request.endpoint).map_err(|e| e.to_string())?;
    if url.scheme() == "https" {
        endpoint = endpoint
            .tls_config(ClientTlsConfig::new().with_native_roots())
            .map_err(|e| e.to_string())?;
    }
    let result = tokio::time::timeout(std::time::Duration::from_secs(30), async move {
        let channel = endpoint
            .connect()
            .await
            .map_err(transport_error)?;
        let mut client = tonic::client::Grpc::new(channel)
            .max_decoding_message_size(LIMIT)
            .max_encoding_message_size(LIMIT);
        client
            .ready()
            .await
            .map_err(|e| Status::unavailable(e.to_string()))?;
        let mut message = Request::new(Bytes::from(payload));
        message.set_timeout(std::time::Duration::from_secs(30));
        if let Some(authorization) = request.authorization {
            message.metadata_mut().insert(
                "authorization",
                authorization
                    .parse()
                    .map_err(|_| Status::invalid_argument("Invalid authorization metadata"))?,
            );
        }
        client
            .unary(
                message,
                tonic::codegen::http::uri::PathAndQuery::from_static(path),
                RawCodec,
            )
            .await
    })
    .await;
    match result {
        Ok(Ok(response)) => Ok(GrpcResponse {
            code: 0,
            payload: Some(STANDARD.encode(response.into_inner())),
            error: None,
        }),
        Ok(Err(error)) => Ok(GrpcResponse {
            code: error.code() as i32,
            payload: None,
            error: Some(error.message().into()),
        }),
        Err(_) => Ok(GrpcResponse {
            code: 4,
            payload: None,
            error: Some("gRPC request timed out after 30 seconds".into()),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failed_responses_serialize_optional_payload_as_null() {
        let response = GrpcResponse {
            code: 14,
            payload: None,
            error: Some("Unavailable".into()),
        };
        assert_eq!(serde_json::to_value(response).unwrap(), serde_json::json!({
            "code": 14, "payload": null, "error": "Unavailable"
        }));
    }

    #[test]
    fn transport_failures_include_the_underlying_cause() {
        let error = Endpoint::from_shared("http://[invalid").unwrap_err();
        let cause = error.source().unwrap().to_string();
        let status = transport_error(error);
        assert_eq!(status.code(), tonic::Code::Unavailable);
        assert!(status.message().contains(&cause));
    }
}
