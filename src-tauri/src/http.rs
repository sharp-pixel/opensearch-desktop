// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

use crate::requests;

#[derive(serde::Serialize)]
pub(crate) struct FetchResponse {
    ok: bool,
    status: u16,
    status_text: String,
    body: serde_json::Value,
    headers: std::collections::HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(serde::Deserialize)]
pub(crate) struct FetchOptions {
    #[serde(rename = "requestId")]
    request_id: Option<String>,
    method: Option<String>,
    headers: Option<std::collections::HashMap<String, String>>,
    body: Option<String>,
}

#[tauri::command]
pub(crate) async fn fetch_proxy(url: String, options: Option<FetchOptions>) -> Result<FetchResponse, String> {
    let id = options.as_ref().and_then(|opts| opts.request_id.clone());
    requests::run(id, fetch_proxy_inner(url, options)).await
}

async fn fetch_proxy_inner(url: String, options: Option<FetchOptions>) -> FetchResponse {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(is_localhost(&url))
        .timeout(std::time::Duration::from_secs(30))
        // A localhost certificate exemption must not follow a redirect to another host.
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let opts = options.unwrap_or(FetchOptions {
        request_id: None,
        method: None,
        headers: None,
        body: None,
    });

    let method = opts.method.unwrap_or_else(|| "GET".to_string());
    
    let mut request = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        "PATCH" => client.patch(&url),
        "HEAD" => client.head(&url),
        _ => client.get(&url),
    };

    if let Some(headers) = opts.headers {
        for (key, value) in headers {
            request = request.header(&key, &value);
        }
    }

    if let Some(body) = opts.body {
        request = request.body(body);
    }

    match request.send().await {
        Ok(response) => {
            let headers = response.headers().iter().filter_map(|(key, value)| value.to_str().ok().map(|value| (key.to_string(), value.to_string()))).collect();
            let status = response.status();
            let status_text = status.canonical_reason().unwrap_or("Unknown").to_string();
            let ok = status.is_success();
            let status_code = status.as_u16();

            match response.text().await {
                Ok(text) => {
                    let body = serde_json::from_str(&text)
                        .unwrap_or(serde_json::Value::String(text));
                    FetchResponse {
                        ok,
                        status: status_code,
                        status_text,
                        body,
                        headers,
                        error: None,
                    }
                }
                Err(e) => FetchResponse {
                    ok: false,
                    status: status_code,
                    status_text,
                    body: serde_json::Value::Null,
                    headers,
                    error: Some(e.to_string()),
                },
            }
        }
        Err(e) => FetchResponse {
            ok: false,
            status: 0,
            status_text: "Network Error".to_string(),
            body: serde_json::Value::Null,
            headers: Default::default(),
            error: Some(e.to_string()),
        },
    }
}

fn is_localhost(url: &str) -> bool {
    reqwest::Url::parse(url).is_ok_and(|parsed| {
        parsed.scheme() == "https"
            && matches!(parsed.host_str(), Some("localhost" | "127.0.0.1"))
    })
}

#[cfg(test)]
mod tests {
    use super::is_localhost;

    #[test]
    fn certificate_exemption_requires_an_exact_local_hostname() {
        assert!(is_localhost("https://localhost:9200"));
        assert!(is_localhost("https://127.0.0.1:9200"));
        for url in [
            "https://localhost.example.com:9200",
            "https://127.0.0.1.example.com",
            "https://localhost@remote.example",
            "https://remote.example/localhost",
            "https://remote.example?host=127.0.0.1",
            "http://localhost:9200",
            "not a URL",
        ] {
            assert!(!is_localhost(url), "{url}");
        }
    }
}
