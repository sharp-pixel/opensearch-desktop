// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

//! AWS credentials and profile management

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AwsProfile {
    pub name: String,
    #[serde(rename = "hasCredentials")]
    pub has_credentials: bool,
    pub region: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AwsProfileCredentials {
    #[serde(rename = "accessKeyId")]
    pub access_key_id: String,
    #[serde(rename = "secretAccessKey")]
    pub secret_access_key: String,
    #[serde(rename = "sessionToken")]
    pub session_token: Option<String>,
    pub region: Option<String>,
}

/// Validate AWS profile name to prevent injection attacks
fn is_valid_profile_name(name: &str) -> bool {
    let pattern = Regex::new(r"^[a-zA-Z0-9_.-]{1,64}$").unwrap();
    pattern.is_match(name)
}

/// Get the AWS credentials file path
fn get_credentials_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".aws").join("credentials"))
}

/// Get the AWS config file path
fn get_config_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".aws").join("config"))
}

/// Parse AWS INI-style config file
fn parse_aws_config_file(content: &str) -> HashMap<String, HashMap<String, String>> {
    let mut profiles: HashMap<String, HashMap<String, String>> = HashMap::new();
    let mut current_profile: Option<String> = None;

    let profile_regex = Regex::new(r"^\[(?:profile\s+)?([^\]]+)\]$").unwrap();

    for line in content.lines() {
        let trimmed = line.trim();

        // Skip empty lines and comments
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with(';') {
            continue;
        }

        // Check for profile header
        if let Some(caps) = profile_regex.captures(trimmed) {
            current_profile = Some(caps[1].trim().to_string());
            profiles
                .entry(current_profile.clone().unwrap())
                .or_default();
            continue;
        }

        // Parse key = value
        if let Some(ref profile) = current_profile {
            if let Some((key, value)) = trimmed.split_once('=') {
                profiles
                    .entry(profile.clone())
                    .or_default()
                    .insert(key.trim().to_string(), value.trim().to_string());
            }
        }
    }

    profiles
}

/// Read AWS credentials file
fn read_aws_credentials() -> HashMap<String, HashMap<String, String>> {
    get_credentials_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .map(|content| parse_aws_config_file(&content))
        .unwrap_or_default()
}

/// Read AWS config file
fn read_aws_config() -> HashMap<String, HashMap<String, String>> {
    get_config_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .map(|content| parse_aws_config_file(&content))
        .unwrap_or_default()
}

#[tauri::command]
pub fn get_aws_profiles() -> Vec<AwsProfile> {
    let credentials = read_aws_credentials();
    let config = read_aws_config();

    let mut profile_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    profile_names.extend(credentials.keys().cloned());
    profile_names.extend(config.keys().cloned());

    let mut profiles: Vec<AwsProfile> = profile_names
        .into_iter()
        .map(|name| {
            let creds = credentials.get(&name);
            let conf = config.get(&name);

            let has_credentials = creds
                .map(|c| {
                    c.contains_key("aws_access_key_id") && c.contains_key("aws_secret_access_key")
                })
                .unwrap_or(false);

            let region = conf
                .and_then(|c| c.get("region").cloned())
                .or_else(|| creds.and_then(|c| c.get("region").cloned()));

            AwsProfile {
                name,
                has_credentials,
                region,
            }
        })
        .collect();

    // Sort with 'default' first
    profiles.sort_by(|a, b| {
        if a.name == "default" {
            std::cmp::Ordering::Less
        } else if b.name == "default" {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    profiles
}

#[tauri::command]
pub fn get_aws_profile_credentials(profile_name: String) -> Option<AwsProfileCredentials> {
    if !is_valid_profile_name(&profile_name) {
        return None;
    }

    let credentials = read_aws_credentials();
    let config = read_aws_config();

    let creds = credentials.get(&profile_name)?;
    let conf = config.get(&profile_name);

    let access_key_id = creds.get("aws_access_key_id")?.clone();
    let secret_access_key = creds.get("aws_secret_access_key")?.clone();
    let session_token = creds.get("aws_session_token").cloned();
    let region = conf
        .and_then(|c| c.get("region").cloned())
        .or_else(|| creds.get("region").cloned());

    Some(AwsProfileCredentials {
        access_key_id,
        secret_access_key,
        session_token,
        region,
    })
}

#[tauri::command]
pub fn refresh_aws_profiles() -> Vec<AwsProfile> {
    get_aws_profiles()
}
