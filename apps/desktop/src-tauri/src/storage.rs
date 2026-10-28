use crate::domain::{Result, field, identifier, validate_config, validate_profile};
use serde_json::{Value, json};
use std::{fs, path::Path, sync::Mutex};
use tauri::Manager;

pub static SETTINGS_LOCK: Mutex<()> = Mutex::new(());
pub static LAUNCH_LOCK: Mutex<()> = Mutex::new(());
pub static TERMINAL_LOCK: Mutex<()> = Mutex::new(());
static OPERATIONS: Mutex<Vec<String>> = Mutex::new(Vec::new());

pub struct LaunchOperation(String);
impl LaunchOperation {
    pub fn begin(id: &str) -> Result<Self> {
        let mut active = OPERATIONS.lock().map_err(|_| "Operation lock failed")?;
        if active.iter().any(|item| item == id) {
            return Err("This tool already has an operation in progress".into());
        }
        active.push(id.to_owned());
        Ok(Self(id.to_owned()))
    }
}
impl Drop for LaunchOperation {
    fn drop(&mut self) {
        if let Ok(mut active) = OPERATIONS.lock() {
            active.retain(|id| id != &self.0);
        }
    }
}

pub fn read(path: &Path, fallback: Value) -> Result<Value> {
    match fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|_| "Stored settings are corrupt; file preserved".into()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(fallback),
        Err(e) => Err(e.to_string()),
    }
}

pub fn write(path: &Path, value: &Value) -> Result<()> {
    fs::create_dir_all(path.parent().ok_or("Missing settings directory")?)
        .map_err(|e| e.to_string())?;
    let temp = path.with_extension("json.tmp");
    let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
    use std::io::Write;
    file.write_all(&serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    file.sync_all().map_err(|e| e.to_string())?;
    drop(file);
    fs::rename(temp, path).map_err(|e| e.to_string())
}

pub fn settings(app: &tauri::AppHandle) -> Result<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .map(|p| p.join("proxy.json"))
        .map_err(|e| e.to_string())
}

pub fn provider_connection_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .map(|p| p.join("provider-connections.json"))
        .map_err(|e| e.to_string())
}

pub fn provider_connections(path: &Path) -> Result<Value> {
    provider_connections_with(path, |service| Ok(vault_get(service)?.is_some()))
}

fn provider_connections_with(
    path: &Path,
    mut has_key: impl FnMut(&str) -> Result<bool>,
) -> Result<Value> {
    let mut value = read(path, json!([]))?;
    let connections = value.as_array_mut().ok_or("Invalid provider connections")?;
    let mut ids = std::collections::HashSet::new();
    for connection in connections {
        crate::domain::validate_provider_connection(connection)?;
        let id = field(connection, "id")?.to_owned();
        if !ids.insert(id.clone()) {
            return Err("Duplicate provider connection id".into());
        }
        let service = format!("vibehub.provider-key.connection.{id}");
        if connection["providerId"] == "ollama" {
            // Reading metadata must not mutate the vault. Writes still remove
            // stale Ollama credentials and requests never send them.
            connection["hasKey"] = json!(false);
        } else {
            connection["hasKey"] = json!(has_key(&service)?);
        }
    }
    Ok(value)
}

pub fn save_provider_connection(
    path: &Path,
    mut connection: Value,
    key: Option<&str>,
) -> Result<Value> {
    crate::domain::validate_provider_connection(&connection)?;
    let id = field(&connection, "id")?.to_owned();
    let provider = field(&connection, "providerId")?.to_owned();
    let origin = crate::domain::safe_url(field(&connection, "baseUrl")?)?
        .origin()
        .ascii_serialization();
    let mut connections = provider_connections(path)?;
    let list = connections
        .as_array_mut()
        .ok_or("Invalid provider connections")?;
    let service = format!("vibehub.provider-key.connection.{id}");
    let scope_changed = list
        .iter()
        .find(|item| item["id"] == id)
        .is_some_and(|previous| {
            previous["providerId"] != provider
                || crate::domain::safe_url(previous["baseUrl"].as_str().unwrap_or(""))
                    .map(|url| url.origin().ascii_serialization())
                    .map_or(true, |previous_origin| previous_origin != origin)
        });
    if scope_changed || provider == "ollama" {
        vault_delete(&service)?;
    }
    if provider == "ollama" {
        // Ignore keys submitted by older clients; never retain one for Ollama.
        connection["hasKey"] = json!(false);
    } else if let Some(secret) = key.filter(|secret| !secret.is_empty()) {
        vault_set(&service, secret)?;
        connection["hasKey"] = json!(true);
    } else {
        let mut has_key = vault_get(&service)?.is_some();
        if !has_key && !scope_changed {
            let legacy = match provider.as_str() {
                "openrouter" => Some("vibehub.provider-key.openrouter"),
                "nvidia" => Some("vibehub.provider-key.nvidia-build"),
                "custom" => Some("vibehub.provider-key.custom-openai-compatible"),
                _ => None,
            };
            if let Some(legacy) = legacy {
                if let Some(secret) = vault_get(legacy)? {
                    vault_set(&service, &secret)?;
                    has_key = true;
                }
            }
        }
        connection["hasKey"] = json!(has_key);
    }
    if let Some(old) = list.iter_mut().find(|item| item["id"] == id) {
        *old = connection;
    } else {
        list.push(connection);
    }
    write(path, &connections)?;
    Ok(connections)
}

pub fn delete_provider_connection(path: &Path, id: &str) -> Result<Value> {
    delete_provider_connection_with(path, id, vault_delete)?;
    provider_connections(path)
}

fn delete_provider_connection_with(
    path: &Path,
    id: &str,
    mut delete: impl FnMut(&str) -> Result<()>,
) -> Result<Value> {
    if !identifier(id) {
        return Err("Invalid provider connection id".into());
    }
    let mut connections = provider_connections_with(path, |_| Ok(false))?;
    let list = connections
        .as_array_mut()
        .ok_or("Invalid provider connections")?;
    if !list.iter().any(|item| item["id"] == id) {
        return Err("Provider connection does not exist".into());
    }
    // A vault error must leave the connection visible and retriable. A file
    // failure after key removal is also safe: reads reconcile hasKey with vault.
    delete(&format!("vibehub.provider-key.connection.{id}"))?;
    list.retain(|item| item["id"] != id);
    write(path, &connections)?;
    Ok(connections)
}

const LEGACY_PROVIDERS: [&str; 3] = ["openrouter", "nvidia-build", "custom-openai-compatible"];

pub fn provider_credentials_inventory(path: &Path) -> Result<Value> {
    provider_credentials_inventory_with(path, |service| Ok(vault_get(service)?.is_some()))
}

pub fn provider_credentials_inventory_with(
    path: &Path,
    mut has_key: impl FnMut(&str) -> Result<bool>,
) -> Result<Value> {
    let connections = provider_connections_with(path, &mut has_key)?;
    let mut legacy = Vec::new();
    for id in LEGACY_PROVIDERS {
        if has_key(&format!("vibehub.provider-key.{id}"))? {
            legacy.push(id);
        }
    }
    Ok(json!({"connections":connections,"legacyProviderIds":legacy}))
}

pub fn provider_credentials_clear(
    path: &Path,
    connection_ids: &[String],
    legacy_provider_ids: &[String],
) -> Result<Value> {
    provider_credentials_clear_with(path, connection_ids, legacy_provider_ids, vault_delete)
}

pub fn provider_credentials_clear_with(
    path: &Path,
    connection_ids: &[String],
    legacy_provider_ids: &[String],
    mut delete: impl FnMut(&str) -> Result<()>,
) -> Result<Value> {
    if connection_ids.len() > 1000
        || legacy_provider_ids.len() > 3
        || connection_ids.iter().any(|id| !identifier(id))
        || legacy_provider_ids
            .iter()
            .any(|id| !LEGACY_PROVIDERS.contains(&id.as_str()))
    {
        return Err("Invalid credential selection".into());
    }
    // Validate the stored metadata before deleting anything. The command caller
    // holds SETTINGS_LOCK, so connection saves cannot race this operation.
    provider_connections_with(path, |_| Ok(false))?;
    let mut removed_connections = Vec::new();
    let mut removed_legacy = Vec::new();
    let mut failures = Vec::new();
    for id in legacy_provider_ids
        .iter()
        .collect::<std::collections::BTreeSet<_>>()
    {
        match delete(&format!("vibehub.provider-key.{id}")) {
            Ok(()) => removed_legacy.push(id.clone()),
            Err(_) => {
                failures.push(json!({"kind":"legacy","id":id,"errorKey":"vaultDeleteFailed"}))
            }
        }
    }
    if !failures.is_empty() {
        for id in connection_ids {
            failures.push(json!({"kind":"connection","id":id,"errorKey":"legacyDeleteBlocked"}));
        }
    } else {
        for id in connection_ids
            .iter()
            .collect::<std::collections::BTreeSet<_>>()
        {
            let current = match provider_connections_with(path, |_| Ok(false)) {
                Ok(current) => current,
                Err(_) => {
                    failures.push(
                        json!({"kind":"connection","id":id,"errorKey":"connectionDeleteFailed"}),
                    );
                    continue;
                }
            };
            if !current
                .as_array()
                .ok_or("Invalid connections")?
                .iter()
                .any(|item| item["id"] == *id)
            {
                // A retry of a previously removed item is idempotent and must
                // never touch an unlisted/new connection's credential.
                removed_connections.push(id.clone());
                continue;
            }
            match delete_provider_connection_with(path, id, &mut delete) {
                Ok(_) => removed_connections.push(id.clone()),
                Err(_) => failures
                    .push(json!({"kind":"connection","id":id,"errorKey":"connectionDeleteFailed"})),
            }
        }
    }
    Ok(
        json!({"deletedConnectionIds":removed_connections,"deletedLegacyProviderIds":removed_legacy,"failures":failures}),
    )
}

pub fn load(path: &Path) -> Result<Value> {
    let value = read(
        path,
        json!({"profiles":[],"config":{"globalProfileId":"","requireProxy":false,"perApp":{}}}),
    )?;
    let profiles = value["profiles"]
        .as_array()
        .ok_or("Invalid stored proxy profiles")?;
    for p in profiles {
        validate_profile(p)?;
    }
    validate_config(&value["config"], profiles)?;
    Ok(value)
}

fn entry(service: &str) -> Result<keyring::Entry> {
    if !service.starts_with("vibehub.")
        || service.len() > 200
        || service.chars().any(char::is_control)
    {
        return Err("Invalid VibeHub vault service".into());
    }
    keyring::Entry::new(service, "VibeHub")
        .map_err(|_| "Windows credential vault is unavailable".into())
}

pub fn vault_get(service: &str) -> Result<Option<String>> {
    match entry(service)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read Windows credential vault".into()),
    }
}

pub fn vault_set(service: &str, key: &str) -> Result<()> {
    if key.is_empty() || key.len() > 2400 || key.chars().any(char::is_control) {
        return Err("Credential must be nonempty and contain no control characters".into());
    }
    entry(service)?
        .set_password(key)
        .map_err(|_| "Could not save Windows credential".into())
}

pub fn vault_delete(service: &str) -> Result<()> {
    match entry(service)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Could not delete Windows credential".into()),
    }
}

pub fn save_profile(path: &Path, mut profile: Value, password: Option<String>) -> Result<Value> {
    let password = password.filter(|value| !value.is_empty());
    if password.is_some() {
        profile["hasPassword"] = json!(true);
    }
    validate_profile(&profile)?;
    let id = field(&profile, "id")?.to_owned();
    let mut state = load(path)?;
    let profiles = state["profiles"].as_array_mut().ok_or("Invalid profiles")?;
    let service = format!("vibehub.proxy.{id}");
    if profile["mode"] == "socks5" {
        if !profile["username"].as_str().unwrap_or("").is_empty() && profile["hasPassword"] != true
        {
            return Err("Enter both SOCKS5 username and password".into());
        }
        let saved_password = password
            .as_deref()
            .map(str::to_owned)
            .or(vault_get(&service)?);
        if saved_password
            .as_ref()
            .is_some_and(|value| value.len() > 255)
        {
            return Err("SOCKS5 password must be at most 255 bytes".into());
        }
    }
    if let Some(password) = password {
        vault_set(&service, &password)?;
    }
    profile["hasPassword"] = json!(vault_get(&service)?.is_some());
    if let Some(old) = profiles.iter_mut().find(|p| p["id"] == id) {
        *old = profile;
    } else {
        profiles.push(profile);
    }
    validate_config(
        &state["config"],
        state["profiles"].as_array().ok_or("Invalid profiles")?,
    )?;
    write(path, &state)?;
    Ok(state["profiles"].clone())
}

pub fn delete_profile(path: &Path, id: &str) -> Result<Value> {
    if !identifier(id) {
        return Err("Invalid profile id".into());
    }
    let mut state = load(path)?;
    let cfg = &state["config"];
    if cfg["globalProfileId"] == id
        || cfg["perApp"]
            .as_object()
            .ok_or("Invalid perApp")?
            .values()
            .any(|v| v == id)
    {
        return Err("Profile is in use. Change proxy configuration before deleting it.".into());
    }
    vault_delete(&format!("vibehub.proxy.{id}"))?;
    state["profiles"]
        .as_array_mut()
        .ok_or("Invalid profiles")?
        .retain(|p| p["id"] != id);
    write(path, &state)?;
    Ok(state["profiles"].clone())
}

pub fn selected_profile(
    path: &Path,
    app_id: &str,
    explicit: Option<&str>,
) -> Result<(Option<Value>, bool)> {
    let state = load(path)?;
    let cfg = &state["config"];
    let id = explicit
        .or_else(|| cfg["perApp"][app_id].as_str())
        .filter(|id| *id != "inherit")
        .unwrap_or(cfg["globalProfileId"].as_str().unwrap_or(""));
    let profile = state["profiles"]
        .as_array()
        .ok_or("Invalid profiles")?
        .iter()
        .find(|p| p["id"] == id)
        .cloned();
    let required = cfg["requireProxy"].as_bool().unwrap_or(false);
    if (!id.is_empty() && profile.is_none())
        || (required
            && !matches!(
                profile.as_ref().and_then(|p| p["mode"].as_str()),
                Some("http" | "socks5")
            ))
    {
        return Err("Required proxy is missing; refusing direct fallback".into());
    }
    Ok((profile, required))
}

pub fn run_launch(path: &Path, id: &str, work: impl FnOnce() -> Result<Value>) -> Result<Value> {
    let _operation = LaunchOperation::begin(id)?;
    let result = work();
    let value = match &result {
        Ok(outcome) => outcome.clone(),
        Err(error) => serde_json::json!({"phase":"failed", "error":error}),
    };
    save_launch_state(path, id, value)?;
    result
}

pub fn save_launch_state(path: &Path, id: &str, value: Value) -> Result<()> {
    let _lock = LAUNCH_LOCK.lock().map_err(|_| "Launch state lock failed")?;
    let mut states = read(path, serde_json::json!({}))?;
    states
        .as_object_mut()
        .ok_or("Invalid launch state")?
        .insert(id.to_owned(), value);
    write(path, &states)
}

#[cfg(test)]
mod launch_concurrency_tests {
    use super::*;
    use std::sync::{Arc, Barrier};

    #[test]
    fn slow_launch_does_not_hold_settings_or_lose_another_tools_state() {
        let path = std::env::temp_dir().join(format!(
            "vibehub-launch-test-{}-{}.json",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
        let started = Arc::new(Barrier::new(2));
        let release = Arc::new(Barrier::new(2));
        let worker_path = path.clone();
        let worker_started = started.clone();
        let worker_release = release.clone();
        let worker = std::thread::spawn(move || {
            run_launch(&worker_path, "slow-test", || {
                {
                    let _settings = SETTINGS_LOCK.lock().unwrap();
                }
                worker_started.wait();
                worker_release.wait(); // Simulate the slow external launcher used by the real commands.
                Ok(serde_json::json!({"pid": 1}))
            })
            .unwrap();
        });
        started.wait();
        assert!(SETTINGS_LOCK.try_lock().is_ok());
        assert!(LaunchOperation::begin("slow-test").is_err());
        run_launch(&path, "other-test", || Ok(serde_json::json!({"pid": 2}))).unwrap();
        release.wait();
        worker.join().unwrap();
        let states = read(&path, Value::Null).unwrap();
        assert_eq!(states["slow-test"]["pid"], 1);
        assert_eq!(states["other-test"]["pid"], 2);
        assert!(LaunchOperation::begin("slow-test").is_ok());
        fs::remove_file(path).unwrap();
    }
}
