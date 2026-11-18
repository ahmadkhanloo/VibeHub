//! Local Claude Code account broker.
//!
//! Claude Code reads its provider from `~/.claude/settings.json` (`env.ANTHROPIC_BASE_URL`,
//! `env.ANTHROPIC_AUTH_TOKEN`, `model`). A saved account is exactly those three values, so
//! applying an account rewrites only those keys and leaves every other setting the user
//! configured untouched. Tokens never cross the webview boundary: they are captured from
//! the file, stored age-encrypted with a key held in the Windows Credential Manager, and
//! written back by the native side only.
use crate::{domain::Result, storage};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::TryRngCore;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Instant,
};
use tauri::Manager;

const MAX_ACCOUNTS: usize = 16;
static BROKER_LOCK: Mutex<Option<()>> = Mutex::new(None);
const ENV_BASE_URL: &str = "ANTHROPIC_BASE_URL";
const ENV_TOKEN: &str = "ANTHROPIC_AUTH_TOKEN";

fn err(key: &str) -> String {
    format!("accounts:{key}")
}
fn now() -> i64 {
    chrono::Utc::now().timestamp()
}
fn fingerprint(value: &Value) -> String {
    format!("{:x}", Sha256::digest(value.to_string().as_bytes()))
}

/// `~/.claude` — the directory Claude Code itself uses, or the documented override.
fn claude_home() -> Result<PathBuf> {
    if let Some(home) = std::env::var_os("CLAUDE_CONFIG_DIR").filter(|s| !s.is_empty()) {
        return Ok(PathBuf::from(home));
    }
    std::env::var_os("USERPROFILE")
        .map(|p| PathBuf::from(p).join(".claude"))
        .ok_or_else(|| err("storage"))
}

fn settings_path(home: &Path) -> PathBuf {
    home.join("settings.json")
}

/// Reads `settings.json`, tolerating a missing file (Claude Code creates it on first run).
fn read_settings(home: &Path) -> Result<Value> {
    let value = storage::read(&settings_path(home), json!({}))
        .map_err(|_| err("configuration"))?;
    if !value.is_object() {
        return Err(err("configuration"));
    }
    Ok(value)
}

/// Writes `settings.json` atomically so a crash cannot truncate the user's config.
fn write_settings(home: &Path, value: &Value) -> Result<()> {
    fs::create_dir_all(home).map_err(|_| err("storage"))?;
    let path = settings_path(home);
    let temp = path.with_extension("vibehub.tmp");
    let mut file = fs::File::create(&temp).map_err(|_| err("storage"))?;
    file.write_all(&serde_json::to_vec_pretty(value).map_err(|_| err("configuration"))?)
        .and_then(|_| file.sync_all())
        .map_err(|_| err("storage"))?;
    drop(file);
    fs::rename(&temp, &path).map_err(|_| err("storage"))
}

/// The account-defining subset of settings, normalised for comparison and storage.
fn account_from_settings(settings: &Value) -> Result<Value> {
    let base_url = settings["env"][ENV_BASE_URL]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_owned();
    let token = settings["env"][ENV_TOKEN]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_owned();
    if token.is_empty() {
        return Err(err("loginRequired"));
    }
    let model = settings["model"].as_str().unwrap_or("").trim().to_owned();
    let digest = format!(
        "{:x}",
        Sha256::digest(format!("{base_url}\n{token}\n{model}").as_bytes())
    );
    Ok(json!({
        "id": format!("claude-{}", &digest[..24]),
        "baseUrl": if base_url.is_empty() { Value::Null } else { json!(base_url) },
        "token": token,
        "model": if model.is_empty() { Value::Null } else { json!(model) },
    }))
}

/// Name shown in the UI: the provider host, plus the model when the host is shared.
fn label(account: &Value) -> String {
    let host = account["baseUrl"]
        .as_str()
        .and_then(|url| url.split("://").nth(1))
        .and_then(|rest| rest.split('/').next())
        .unwrap_or("Anthropic");
    match account["model"].as_str() {
        Some(model) if !model.is_empty() => format!("{host} · {model}"),
        _ => host.to_owned(),
    }
}

fn credential_path(root: &Path, id: &str) -> PathBuf {
    root.join(id).join("credential.age")
}
fn encryption_entry(root: &Path, id: &str) -> Result<keyring::Entry> {
    let canonical = root.canonicalize().map_err(|_| err("storage"))?;
    let digest = format!(
        "{:x}",
        Sha256::digest(format!("{}\n{id}", canonical.to_string_lossy()).as_bytes())
    );
    keyring::Entry::new("claude", &format!("account|{}", &digest[..16]))
        .map_err(|_| err("vault"))
}
fn encryption_key(root: &Path, id: &str, create: bool) -> Result<age::secrecy::SecretString> {
    let entry = encryption_entry(root, id)?;
    match entry.get_password() {
        Ok(value) => Ok(age::secrecy::SecretString::from(value)),
        Err(keyring::Error::NoEntry) if create => {
            let mut bytes = [0u8; 32];
            rand::rngs::OsRng
                .try_fill_bytes(&mut bytes)
                .map_err(|_| err("vault"))?;
            let password = URL_SAFE_NO_PAD.encode(bytes);
            entry.set_password(&password).map_err(|_| err("vault"))?;
            Ok(age::secrecy::SecretString::from(password))
        }
        _ => Err(err("vault")),
    }
}
fn write_credential(root: &Path, id: &str, account: &Value) -> Result<()> {
    let path = credential_path(root, id);
    fs::create_dir_all(path.parent().ok_or_else(|| err("storage"))?)
        .map_err(|_| err("storage"))?;
    let key = encryption_key(root, id, true)?;
    let ciphertext = age::encrypt(
        &age::scrypt::Recipient::new(key),
        account.to_string().as_bytes(),
    )
    .map_err(|_| err("vault"))?;
    let temp = path.with_extension("tmp");
    fs::write(&temp, ciphertext).map_err(|_| err("storage"))?;
    fs::rename(&temp, &path).map_err(|_| err("storage"))
}
fn read_credential(root: &Path, id: &str) -> Result<Value> {
    let path = credential_path(root, id);
    if !path.exists() {
        return Err(err("loginRequired"));
    }
    let ciphertext = fs::read(&path).map_err(|_| err("storage"))?;
    let mut identity = age::scrypt::Identity::new(encryption_key(root, id, false)?);
    identity.set_max_work_factor(20);
    let plaintext = age::decrypt(&identity, &ciphertext).map_err(|_| err("vault"))?;
    let account: Value =
        serde_json::from_slice(&plaintext).map_err(|_| err("credentialInvalid"))?;
    if !account["id"].is_string() || !account["token"].is_string() {
        return Err(err("credentialInvalid"));
    }
    Ok(account)
}
fn delete_credential(root: &Path, id: &str) -> Result<()> {
    let path = credential_path(root, id);
    if path.exists() {
        fs::remove_file(&path).map_err(|_| err("storage"))?;
    }
    if let Ok(entry) = encryption_entry(root, id) {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            _ => return Err(err("vault")),
        }
    }
    // The account directory holds nothing else; a leftover would keep showing up.
    if let Some(parent) = path.parent() {
        let _ = fs::remove_dir(parent);
    }
    Ok(())
}

/// Applies one account to `settings.json`, verifying the written values before claiming success.
fn apply_account(home: &Path, account: &Value) -> Result<()> {
    let mut settings = read_settings(home)?;
    if !settings.is_object() {
        return Err(err("configuration"));
    }
    if !settings["env"].is_object() {
        settings["env"] = json!({});
    }
    match account["baseUrl"].as_str().filter(|value| !value.is_empty()) {
        Some(url) => settings["env"][ENV_BASE_URL] = json!(url),
        None => {
            if let Some(env) = settings["env"].as_object_mut() {
                env.remove(ENV_BASE_URL);
            }
        }
    }
    settings["env"][ENV_TOKEN] = account["token"].clone();
    match account["model"].as_str().filter(|value| !value.is_empty()) {
        Some(model) => settings["model"] = json!(model),
        None => {
            if let Some(object) = settings.as_object_mut() {
                object.remove("model");
            }
        }
    }
    write_settings(home, &settings)?;
    // Verify from disk: a partial write must never be reported as a completed switch.
    // Only the managed keys are compared; the id is deliberately not recomputed here
    // because callers may pass an account whose label was derived earlier.
    let written = account_from_settings(&read_settings(home)?)?;
    if written["token"] != account["token"]
        || written["baseUrl"] != account["baseUrl"]
        || written["model"] != account["model"]
    {
        return Err(err("switchFailed"));
    }
    Ok(())
}

fn valid_id(id: &str) -> bool {
    id.len() > "claude-".len()
        && id.starts_with("claude-")
        && id.len() <= 40
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-')
}

fn accounts_root(app: &tauri::AppHandle) -> Result<PathBuf> {
    let root = app
        .path()
        .app_config_dir()
        .map_err(|_| err("storage"))?
        .join("claude-accounts");
    fs::create_dir_all(&root).map_err(|_| err("storage"))?;
    Ok(root)
}

fn state_path(root: &Path) -> PathBuf {
    root.join("accounts.json")
}

fn read_state(root: &Path) -> Result<Value> {
    let state = storage::read(
        &state_path(root),
        json!({"accounts":[],"activeId":null,"fingerprint":null,"notice":null,"updatedAt":null}),
    )
    .map_err(|_| err("storage"))?;
    if !state["accounts"].is_array() {
        return Err(err("storage"));
    }
    Ok(state)
}

fn write_state(root: &Path, state: &Value) -> Result<()> {
    storage::write(&state_path(root), state).map_err(|_| err("storage"))
}

/// Index of the account that matches what `settings.json` currently holds, if saved.
fn active_from_settings(state: &Value, current: &Value) -> Option<String> {
    state["accounts"]
        .as_array()
        .and_then(|accounts| {
            accounts
                .iter()
                .find(|account| account["id"] == current["id"])
        })
        .and_then(|account| account["id"].as_str())
        .map(str::to_owned)
}

fn snapshot(state: &Value, current: Option<&Value>) -> Value {
    let active_id = current.and_then(|value| active_from_settings(state, value));
    let accounts: Vec<Value> = state["accounts"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|account| {
            json!({
                "id": account["id"],
                "name": account["name"],
                "label": label(account),
                "active": active_id.as_deref() == account["id"].as_str(),
                "updatedAt": account["updatedAt"],
            })
        })
        .collect();
    json!({
        "app": "claude-code",
        "accounts": accounts,
        "activeId": active_id,
        "notice": state["notice"],
        "configured": current.is_some(),
        "current": current.map(label),
        "settingsPath": state["settingsPath"],
    })
}

pub fn handle(app: &tauri::AppHandle, action: &str, payload: Value) -> Result<Value> {
    let mut guard = BROKER_LOCK.try_lock().map_err(|_| err("busy"))?;
    if guard.is_none() {
        *guard = Some(());
    }
    let started = Instant::now();
    let root = accounts_root(app)?;
    let home = claude_home()?;
    let mut state = read_state(&root)?;
    state["settingsPath"] = json!(settings_path(&home).to_string_lossy());

    let settings = read_settings(&home)?;
    let current = account_from_settings(&settings).ok();

    let name_from = |payload: &Value| -> String {
        payload["name"]
            .as_str()
            .unwrap_or("")
            .trim()
            .chars()
            .filter(|c| !c.is_control())
            .take(120)
            .collect()
    };

    match action {
        "list" => {}
        "save" => {
            let account = current.clone().ok_or_else(|| err("loginRequired"))?;
            let id = account["id"].as_str().unwrap_or_default().to_owned();
            let existing = state["accounts"]
                .as_array()
                .and_then(|accounts| {
                    accounts
                        .iter()
                        .position(|entry| entry["id"] == account["id"])
                });
            let name = {
                let typed = name_from(&payload);
                if typed.is_empty() {
                    existing
                        .and_then(|index| state["accounts"][index]["name"].as_str())
                        .map(str::to_owned)
                        .unwrap_or_else(|| label(&account))
                } else {
                    typed
                }
            };
            let stored = json!({
                "id": account["id"],
                "name": name,
                "baseUrl": account["baseUrl"],
                "model": account["model"],
                "updatedAt": now(),
            });
            write_credential(&root, &id, &account)?;
            match existing {
                Some(index) => state["accounts"][index] = stored,
                None => {
                    let count = state["accounts"].as_array().map(Vec::len).unwrap_or(0);
                    if count >= MAX_ACCOUNTS {
                        return Err(err("tooMany"));
                    }
                    state["accounts"]
                        .as_array_mut()
                        .ok_or_else(|| err("storage"))?
                        .push(stored);
                }
            }
            state["notice"] = json!("saved");
            write_state(&root, &state)?;
        }
        "apply" => {
            let id = payload["id"].as_str().ok_or_else(|| err("unknownAccount"))?;
            if !valid_id(id) {
                return Err(err("unknownAccount"));
            }
            let known = state["accounts"]
                .as_array()
                .is_some_and(|accounts| accounts.iter().any(|entry| entry["id"] == json!(id)));
            if !known {
                return Err(err("unknownAccount"));
            }
            let account = read_credential(&root, id)?;
            // Claude Code rewrites settings.json while it runs, so refuse to clobber it.
            if state["fingerprint"]
                .as_str()
                .is_some_and(|saved| saved != fingerprint(&settings))
            {
                return Err(err("externalChanged"));
            }
            apply_account(&home, &account)?;
            state["activeId"] = json!(id);
            state["fingerprint"] = json!(fingerprint(&read_settings(&home)?));
            state["notice"] = json!("switched");
            state["updatedAt"] = json!(now());
            write_state(&root, &state)?;
        }
        "track" => {
            // Record the current file so a later apply can detect external edits.
            state["fingerprint"] = json!(fingerprint(&settings));
            write_state(&root, &state)?;
        }
        "rename" => {
            let id = payload["id"].as_str().ok_or_else(|| err("unknownAccount"))?;
            let name = name_from(&payload);
            if name.is_empty() {
                return Err(err("invalidName"));
            }
            let index = state["accounts"]
                .as_array()
                .and_then(|accounts| accounts.iter().position(|entry| entry["id"] == json!(id)))
                .ok_or_else(|| err("unknownAccount"))?;
            state["accounts"][index]["name"] = json!(name);
            write_state(&root, &state)?;
        }
        "delete" => {
            let id = payload["id"].as_str().ok_or_else(|| err("unknownAccount"))?;
            if !valid_id(id) {
                return Err(err("unknownAccount"));
            }
            let index = state["accounts"]
                .as_array()
                .and_then(|accounts| accounts.iter().position(|entry| entry["id"] == json!(id)))
                .ok_or_else(|| err("unknownAccount"))?;
            delete_credential(&root, id)?;
            state["accounts"]
                .as_array_mut()
                .ok_or_else(|| err("storage"))?
                .remove(index);
            if state["activeId"] == json!(id) {
                state["activeId"] = Value::Null;
            }
            write_state(&root, &state)?;
        }
        "dismiss" => {
            state["notice"] = Value::Null;
            write_state(&root, &state)?;
        }
        _ => return Err(err("unsupportedAction")),
    }

    let _ = started;
    Ok(snapshot(&state, current.as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sandbox() -> PathBuf {
        use std::sync::atomic::{AtomicU64, Ordering};
        static NEXT: AtomicU64 = AtomicU64::new(0);
        let path = std::env::temp_dir().join(format!(
            "vibehub-claude-{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn account_identity_tracks_provider_token_and_model() {
        let settings = json!({
            "env": {"ANTHROPIC_BASE_URL": "https://api.example", "ANTHROPIC_AUTH_TOKEN": "secret"},
            "model": "model-a",
        });
        let first = account_from_settings(&settings).unwrap();
        assert!(first["id"].as_str().unwrap().starts_with("claude-"));
        assert_eq!(first["token"], json!("secret"));
        let same = account_from_settings(&settings).unwrap();
        assert_eq!(first["id"], same["id"]);
        let mut moved = settings.clone();
        moved["model"] = json!("model-b");
        assert_ne!(account_from_settings(&moved).unwrap()["id"], first["id"]);
    }

    #[test]
    fn a_settings_file_without_a_token_is_not_an_account() {
        let settings = json!({"env": {"ANTHROPIC_BASE_URL": "https://api.example"}});
        assert_eq!(
            account_from_settings(&settings).unwrap_err(),
            err("loginRequired")
        );
    }

    #[test]
    fn applying_an_account_only_touches_the_managed_keys() {
        let home = sandbox();
        let original = json!({
            "env": {"KEEP_ME": "yes", "ANTHROPIC_AUTH_TOKEN": "old"},
            "model": "old-model",
            "theme": "dark",
        });
        write_settings(&home, &original).unwrap();
        let account = json!({
            "id": "claude-abc",
            "baseUrl": "https://api.example",
            "token": "new-token",
            "model": "new-model",
        });
        apply_account(&home, &account).unwrap();
        let written = read_settings(&home).unwrap();
        assert_eq!(written["env"]["KEEP_ME"], json!("yes"));
        assert_eq!(written["env"][ENV_TOKEN], json!("new-token"));
        assert_eq!(written["env"][ENV_BASE_URL], json!("https://api.example"));
        assert_eq!(written["model"], json!("new-model"));
        assert_eq!(written["theme"], json!("dark"));
        fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn switching_back_restores_the_previous_provider() {
        let home = sandbox();
        write_settings(
            &home,
            &json!({"env": {"ANTHROPIC_AUTH_TOKEN": "first", "ANTHROPIC_BASE_URL": "https://one.example"}}),
        )
        .unwrap();
        let first = account_from_settings(&read_settings(&home).unwrap()).unwrap();
        let second = json!({"env": {"ANTHROPIC_BASE_URL": "https://two.example", "ANTHROPIC_AUTH_TOKEN": "second"}});
        apply_account(&home, &account_from_settings(&second).unwrap()).unwrap();
        assert_eq!(read_settings(&home).unwrap()["env"][ENV_TOKEN], json!("second"));
        apply_account(&home, &first).unwrap();
        let restored = read_settings(&home).unwrap();
        assert_eq!(restored["env"][ENV_TOKEN], json!("first"));
        assert_eq!(restored["env"][ENV_BASE_URL], json!("https://one.example"));
        fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn ids_must_be_namespaced_and_path_safe() {
        assert!(valid_id("claude-0123456789abcdef01234567"));
        for bad in ["", "account-x", "claude-../../etc", "claude-a/b", "claude-"] {
            assert!(!valid_id(bad), "{bad} must be rejected");
        }
    }
}
