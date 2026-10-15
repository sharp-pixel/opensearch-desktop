// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

use std::{collections::HashMap, future::Future, sync::{Mutex, OnceLock}};
use tokio::sync::oneshot;

fn active() -> &'static Mutex<HashMap<String, oneshot::Sender<()>>> {
    static ACTIVE: OnceLock<Mutex<HashMap<String, oneshot::Sender<()>>>> = OnceLock::new();
    ACTIVE.get_or_init(|| Mutex::new(HashMap::new()))
}

#[tauri::command]
pub fn cancel_request(request_id: String) {
    if let Some(sender) = active().lock().unwrap().remove(&request_id) { let _ = sender.send(()); }
}

pub async fn run<T>(id: Option<String>, operation: impl Future<Output = T>) -> Result<T, String> {
    let Some(id) = id else { return Ok(operation.await); };
    if id.is_empty() || id.len() > 100 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_') {
        return Err("Invalid request ID".into());
    }
    let (sender, receiver) = oneshot::channel();
    {
        let mut requests = active().lock().unwrap();
        if requests.contains_key(&id) { return Err("Duplicate request ID".into()); }
        requests.insert(id.clone(), sender);
    }
    // Cleanup also runs if the invoking task itself is dropped.
    struct Registration(String);
    impl Drop for Registration {
        fn drop(&mut self) { active().lock().unwrap().remove(&self.0); }
    }
    let _registration = Registration(id);
    tokio::select! {
        value = operation => Ok(value),
        _ = receiver => Err("Request canceled".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn cancellation_drops_pending_work_and_releases_id() {
        let task = tokio::spawn(run(Some("test-cancel".into()), std::future::pending::<()>()));
        tokio::task::yield_now().await;
        cancel_request("test-cancel".into());
        assert!(task.await.unwrap().is_err());
        assert!(run(Some("test-cancel".into()), async { 42 }).await.is_ok());
    }
}
