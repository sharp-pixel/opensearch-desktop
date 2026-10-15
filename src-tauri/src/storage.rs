// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

//! Secret references backed by the operating-system credential store.
use keyring::Entry;
use std::sync::atomic::{AtomicU64, Ordering};

const SERVICE_NAME: &str = "opensearch-developer-workbench";

#[tauri::command]
pub fn safe_storage_is_available() -> bool {
    // Probe a real read. Creating an Entry alone does not establish availability.
    matches!(Entry::new(SERVICE_NAME, "availability-probe").and_then(|entry| entry.get_password()),
        Ok(_) | Err(keyring::Error::NoEntry))
}

#[tauri::command]
pub fn safe_storage_encrypt(plaintext: String, reference: Option<String>) -> Option<String> {
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).ok()?.as_nanos();
    let reference = reference.unwrap_or_else(|| format!("keyring:{:x}-{:x}-{:x}", timestamp, std::process::id(), SEQUENCE.fetch_add(1, Ordering::Relaxed)));
    if !valid_reference(&reference) { return None; }
    // A reserved reference creates a new entry; it must never overwrite an existing credential.
    if !matches!(Entry::new(SERVICE_NAME, &reference).and_then(|entry| entry.get_password()), Err(keyring::Error::NoEntry)) {
        return None;
    }
    store_secret(&reference, &plaintext).ok()?;
    Some(reference)
}

#[tauri::command]
pub fn safe_storage_decrypt(encrypted_base64: String) -> Option<String> {
    // Reject the old Base64 placeholder; it was never encrypted storage.
    if !valid_reference(&encrypted_base64) { return None; }
    get_secret(&encrypted_base64)
}

#[tauri::command]
pub fn safe_storage_delete(reference: String) -> Result<(), String> {
    if !valid_reference(&reference) { return Err("Invalid secret reference".into()); }
    delete_secret(&reference)
}

fn valid_reference(reference: &str) -> bool {
    reference.strip_prefix("keyring:").is_some_and(|key| !key.is_empty() && key.len() <= 100
        && key.bytes().all(|c| c.is_ascii_hexdigit() || c == b'-'))
}

pub fn store_secret(key: &str, value: &str) -> Result<(), String> {
    Entry::new(SERVICE_NAME, key).and_then(|entry| entry.set_password(value)).map_err(|e| e.to_string())
}
pub fn get_secret(key: &str) -> Option<String> {
    Entry::new(SERVICE_NAME, key).ok()?.get_password().ok()
}
pub fn delete_secret(key: &str) -> Result<(), String> {
    match Entry::new(SERVICE_NAME, key).and_then(|entry| entry.delete_credential()) {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[ignore = "requires the operating-system credential store"]
    fn native_vault_round_trip() {
        let reference = safe_storage_encrypt("workbench-test-disposable-secret".into(), None)
            .expect("Operating-system credential store must accept a test secret");
        let actual = safe_storage_decrypt(reference.clone());
        // The renderer may reserve a reference before the IPC call. It cannot overwrite a live one.
        assert_eq!(safe_storage_encrypt("replacement".into(), Some(reference.clone())), None);
        safe_storage_delete(reference.clone()).expect("Test credential must be cleaned up");
        assert_eq!(actual.as_deref(), Some("workbench-test-disposable-secret"));
        assert_eq!(safe_storage_decrypt(reference), None);
    }

    #[test]
    #[ignore = "requires the operating-system credential store"]
    fn native_vault_reserved_reference() {
        let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        let reference = format!("keyring:{:x}-{:x}", timestamp, std::process::id());
        let stored = safe_storage_encrypt("workbench-test-reserved-secret".into(), Some(reference.clone()));
        let actual = safe_storage_decrypt(reference.clone());
        safe_storage_delete(reference.clone()).expect("Test credential must be cleaned up");
        assert_eq!(stored.as_deref(), Some(reference.as_str()));
        assert_eq!(actual.as_deref(), Some("workbench-test-reserved-secret"));
    }

    #[test]
    fn rejects_plain_base64_and_foreign_references() {
        assert!(!valid_reference("c2VjcmV0"));
        assert!(!valid_reference("keyring:"));
        assert!(!valid_reference("keyring:../../secret"));
        assert!(valid_reference("keyring:abcd-1"));
        assert_eq!(safe_storage_decrypt("c2VjcmV0".into()), None);
        assert_eq!(safe_storage_encrypt("unused".into(), Some("foreign-reference".into())), None);
    }
}
