//! Opaque account switching for apps that keep their session in a machine-bound blob.
//!
//! ZCode and Qoder encrypt their login state themselves (`enc:v2:os:` envelopes and a
//! binary `auth.v1.dat`). VibeHub never decrypts or reads those tokens: an account is a
//! byte-for-byte snapshot of the session files, sealed with an age key held in the
//! Windows Credential Manager. Switching closes the app, backs up the live files,
//! restores the snapshot atomically and reopens the app.
//!
//! Two consequences are deliberate and surfaced in the UI:
//! * snapshots only work on this machine and user, because the app's own key is local;
//! * the session file is shared with unrelated state, so restoring rolls that state back.
use crate::domain::Result;
use crate::system;
use base64::{Engine, engine::general_purpose::STANDARD as BASE64, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::TryRngCore;
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::Manager;

const MAX_ACCOUNTS: usize = 16;
const MAX_BACKUPS: usize = 5;
static BROKER_LOCK: Mutex<Option<()>> = Mutex::new(None);

fn err(key: &str) -> String {
    format!("accounts:{key}")
}
fn now() -> i64 {
    chrono::Utc::now().timestamp()
}
fn sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

/// Resolves (or creates) the age key for one stored object.
type KeyFn<'a> = dyn Fn(&str, bool) -> Result<age::secrecy::SecretString> + 'a;

/// Which base directory an app keeps its session under.
#[derive(Clone, Copy)]
enum Base {
    UserProfile,
    RoamingAppData,
}

/// Everything the broker needs about one app; adding an app is one table entry.
struct AppSpec {
    id: &'static str,
    base: Base,
    segments: &'static [&'static str],
    /// Files whose absence means "not signed in yet".
    required: &'static [&'static str],
    /// Files captured when present, ignored when absent.
    optional: &'static [&'static str],
    /// File whose bytes identify this machine for the app's own encryption.
    machine_id: Option<&'static str>,
}

const APPS: &[AppSpec] = &[
    AppSpec {
        id: "zcode",
        base: Base::UserProfile,
        segments: &[".zcode", "v2"],
        required: &["credentials.json"],
        // `credential-source` is a three-byte hint about where credentials come from.
        // Provider/config files stay out so plugin choices and settings survive a switch.
        optional: &["credential-source"],
        machine_id: None,
    },
    AppSpec {
        id: "qoder",
        base: Base::RoamingAppData,
        segments: &["com.qoder.app.stable"],
        required: &["auth.v1.dat"],
        optional: &["auth-profile-overlays.v1.dat"],
        // Never swapped: a snapshot from another machine must fail loudly instead of
        // restoring a blob this machine's app cannot decrypt.
        machine_id: Some("auth.machine-id"),
    },
];

fn spec(app_id: &str) -> Result<&'static AppSpec> {
    APPS.iter()
        .find(|entry| entry.id == app_id)
        .ok_or_else(|| err("unsupportedApp"))
}

fn app_home(spec: &AppSpec) -> Result<PathBuf> {
    let base = match spec.base {
        Base::UserProfile => std::env::var_os("USERPROFILE"),
        Base::RoamingAppData => std::env::var_os("APPDATA"),
    }
    .ok_or_else(|| err("storage"))?;
    let mut path = PathBuf::from(base);
    for segment in spec.segments {
        path.push(segment);
    }
    Ok(path)
}

fn is_valid_id(spec: &AppSpec, id: &str) -> bool {
    let prefix = format!("{}-", spec.id);
    id.len() > prefix.len()
        && id.starts_with(&prefix)
        && id.len() <= 48
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
}

// ---------------------------------------------------------------- sealing

fn vault_entry(store: &Path, service: &str, key_id: &str) -> Result<keyring::Entry> {
    let canonical = store.canonicalize().map_err(|_| err("storage"))?;
    let digest = format!(
        "{:x}",
        Sha256::digest(format!("{}\n{key_id}", canonical.to_string_lossy()).as_bytes())
    );
    keyring::Entry::new(service, &format!("{key_id}|{}", &digest[..16])).map_err(|_| err("vault"))
}

fn vault_key(
    store: &Path,
    service: &str,
    key_id: &str,
    create: bool,
) -> Result<age::secrecy::SecretString> {
    let entry = vault_entry(store, service, key_id)?;
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

fn seal(key: &age::secrecy::SecretString, bytes: &[u8], path: &Path) -> Result<()> {
    fs::create_dir_all(path.parent().ok_or_else(|| err("storage"))?).map_err(|_| err("storage"))?;
    let ciphertext =
        age::encrypt(&age::scrypt::Recipient::new(key.clone()), bytes).map_err(|_| err("vault"))?;
    let temp = path.with_extension("age.tmp");
    let mut file = fs::File::create(&temp).map_err(|_| err("storage"))?;
    file.write_all(&ciphertext)
        .and_then(|_| file.sync_all())
        .map_err(|_| err("storage"))?;
    drop(file);
    fs::rename(&temp, path).map_err(|_| err("storage"))
}

fn unseal(key: &age::secrecy::SecretString, path: &Path) -> Result<Vec<u8>> {
    let ciphertext = fs::read(path).map_err(|_| err("storage"))?;
    let mut identity = age::scrypt::Identity::new(key.clone());
    identity.set_max_work_factor(20);
    age::decrypt(&identity, &ciphertext).map_err(|_| err("vault"))
}

// ---------------------------------------------------------------- session files

/// Live bytes of every session file that exists right now.
fn read_session_in(home: &Path, spec: &AppSpec) -> Result<Vec<(String, Vec<u8>)>> {
    let mut files = Vec::new();
    for name in spec.required {
        let bytes = match fs::read(home.join(name)) {
            Ok(bytes) => bytes,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Err(err("loginRequired")),
            Err(_) => return Err(err("storage")),
        };
        files.push(((*name).to_owned(), bytes));
    }
    for name in spec.optional {
        if let Ok(bytes) = fs::read(home.join(name)) {
            files.push(((*name).to_owned(), bytes));
        }
    }
    Ok(files)
}

/// Content hash of every session file that exists; the unit of change detection.
fn fingerprints_in(home: &Path, spec: &AppSpec) -> Result<BTreeMap<String, String>> {
    let mut out = BTreeMap::new();
    for name in spec.required.iter().chain(spec.optional) {
        if let Ok(bytes) = fs::read(home.join(name)) {
            out.insert((*name).to_owned(), sha256(&bytes));
        }
    }
    Ok(out)
}

fn machine_fingerprint_in(home: &Path, spec: &AppSpec) -> Option<String> {
    let bytes = fs::read(home.join(spec.machine_id?)).ok()?;
    Some(sha256(&bytes))
}

fn hashes_of(files: &[(String, Vec<u8>)]) -> BTreeMap<String, String> {
    files
        .iter()
        .map(|(name, bytes)| (name.clone(), sha256(bytes)))
        .collect()
}

/// Writes one file through a temp file so a crash cannot leave a truncated credential.
fn write_file_atomic(home: &Path, name: &str, bytes: &[u8]) -> Result<()> {
    fs::create_dir_all(home).map_err(|_| err("storage"))?;
    let target = home.join(name);
    let temp = target.with_extension("vibehub.tmp");
    let mut file = fs::File::create(&temp).map_err(|_| err("storage"))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| err("storage"))?;
    drop(file);
    fs::rename(&temp, &target).map_err(|_| err("storage"))
}

/// Rejects names outside the app's declared file set, so a tampered blob cannot write elsewhere.
fn restore_blob_in(home: &Path, spec: &AppSpec, files: &[(String, Vec<u8>)]) -> Result<()> {
    for (name, bytes) in files {
        if !spec.required.contains(&name.as_str()) && !spec.optional.contains(&name.as_str()) {
            return Err(err("credentialInvalid"));
        }
        write_file_atomic(home, name, bytes)?;
    }
    Ok(())
}

fn files_to_value(files: &[(String, Vec<u8>)]) -> Value {
    let map: Map<String, Value> = files
        .iter()
        .map(|(name, bytes)| (name.clone(), json!(BASE64.encode(bytes))))
        .collect();
    json!(map)
}

fn files_from_value(blob: &Value) -> Result<Vec<(String, Vec<u8>)>> {
    let object = blob.as_object().ok_or_else(|| err("credentialInvalid"))?;
    if object.is_empty() {
        return Err(err("credentialInvalid"));
    }
    let mut files = Vec::new();
    for (name, encoded) in object {
        if name.contains('/') || name.contains('\\') || name.contains("..") {
            return Err(err("credentialInvalid"));
        }
        let bytes = BASE64
            .decode(encoded.as_str().ok_or_else(|| err("credentialInvalid"))?)
            .map_err(|_| err("credentialInvalid"))?;
        files.push((name.clone(), bytes));
    }
    Ok(files)
}

fn snapshot_value(home: &Path, spec: &AppSpec, files: &[(String, Vec<u8>)]) -> Value {
    json!({
        "files": files_to_value(files),
        "machineIdHash": machine_fingerprint_in(home, spec),
        "capturedAt": now(),
    })
}

fn snapshot_files(blob: &Value) -> Result<Vec<(String, Vec<u8>)>> {
    files_from_value(&blob["files"])
}

// ---------------------------------------------------------------- state

fn store_root(app: &tauri::AppHandle, spec: &AppSpec) -> Result<PathBuf> {
    let root = app
        .path()
        .app_config_dir()
        .map_err(|_| err("storage"))?
        .join("app-accounts")
        .join(spec.id);
    fs::create_dir_all(root.join("backup")).map_err(|_| err("storage"))?;
    Ok(root)
}

fn state_path(store: &Path) -> PathBuf {
    store.join("accounts.json")
}

fn read_state(store: &Path) -> Result<Value> {
    let state = crate::storage::read(
        &state_path(store),
        json!({"accounts":[],"activeId":null,"fingerprints":null,"notice":null,"backups":[]}),
    )
    .map_err(|_| err("storage"))?;
    if !state["accounts"].is_array() || !state["backups"].is_array() {
        return Err(err("storage"));
    }
    Ok(state)
}

fn write_state(store: &Path, state: &Value) -> Result<()> {
    crate::storage::write(&state_path(store), state).map_err(|_| err("storage"))
}

fn blob_path(store: &Path, id: &str) -> PathBuf {
    store.join(id).join("blob.age")
}

fn account_index(state: &Value, id: &str) -> Result<usize> {
    state["accounts"]
        .as_array()
        .and_then(|accounts| accounts.iter().position(|entry| entry["id"] == json!(id)))
        .ok_or_else(|| err("unknownAccount"))
}

fn known_hashes(state: &Value) -> Option<BTreeMap<String, String>> {
    let object = state["fingerprints"].as_object()?;
    let mut out = BTreeMap::new();
    for (name, hash) in object {
        out.insert(name.clone(), hash.as_str()?.to_owned());
    }
    Some(out)
}

fn hashes_value(hashes: &BTreeMap<String, String>) -> Value {
    json!(hashes)
}

// ---------------------------------------------------------------- capture and restore

/// Captures the current session as an account snapshot and returns its id.
fn capture_account(
    home: &Path,
    store: &Path,
    spec: &AppSpec,
    keys: &KeyFn<'_>,
    state: &mut Value,
    name: &str,
) -> Result<String> {
    let files = read_session_in(home, spec)?;
    let mut digest_input = String::new();
    for (file_name, bytes) in &files {
        digest_input.push_str(file_name);
        digest_input.push('\u{0}');
        digest_input.push_str(&sha256(bytes));
        digest_input.push('\u{0}');
    }
    let id = format!("{}-{}", spec.id, &sha256(digest_input.as_bytes())[..24]);
    let key = keys(&format!("account|{id}"), true)?;
    seal(
        &key,
        snapshot_value(home, spec, &files).to_string().as_bytes(),
        &blob_path(store, &id),
    )?;

    let size: usize = files.iter().map(|(_, bytes)| bytes.len()).sum();
    // Recapturing an account the user already named must not overwrite that name.
    let existing_name = account_index(state, &id)
        .ok()
        .and_then(|index| state["accounts"][index]["name"].as_str().map(str::to_owned));
    let label: String = if let Some(existing) = existing_name.filter(|_| name.trim().is_empty()) {
        existing
    } else if name.trim().is_empty() {
        format!("{} · {}", spec.id, &id[id.len() - 6..])
    } else {
        name.trim()
            .chars()
            .filter(|c| !c.is_control())
            .take(120)
            .collect()
    };
    let record = json!({
        "id": id,
        "name": label,
        "size": size,
        "files": files.iter().map(|(file, _)| file.clone()).collect::<Vec<_>>(),
        "capturedAt": now(),
        "updatedAt": now(),
    });
    match account_index(state, &id) {
        Ok(index) => state["accounts"][index] = record,
        Err(_) => {
            let count = state["accounts"].as_array().map(Vec::len).unwrap_or(0);
            if count >= MAX_ACCOUNTS {
                return Err(err("tooMany"));
            }
            state["accounts"]
                .as_array_mut()
                .ok_or_else(|| err("storage"))?
                .push(record);
        }
    }
    state["fingerprints"] = hashes_value(&hashes_of(&files));
    state["activeId"] = json!(id);
    Ok(id)
}

/// Copies the live session into an encrypted backup and records it in state.
fn backup_current(
    home: &Path,
    store: &Path,
    service: &str,
    spec: &AppSpec,
    keys: &KeyFn<'_>,
    state: &mut Value,
    reason: &str,
) -> Result<(PathBuf, String)> {
    let files = read_session_in(home, spec)?;
    let key_id = format!("backup|{}|{reason}", now());
    let key = keys(&key_id, true)?;
    let name = format!("{reason}-{}.age", now());
    let path = store.join("backup").join(&name);
    seal(
        &key,
        snapshot_value(home, spec, &files).to_string().as_bytes(),
        &path,
    )?;
    state["backups"].as_array_mut().ok_or_else(|| err("storage"))?.push(json!({
        "path": name,
        "at": now(),
        "reason": reason,
        "keyId": key_id,
    }));
    prune_backups(store, service, state);
    Ok((path, key_id))
}

/// Keeps the newest backups and drops both their file and their vault key.
fn prune_backups(store: &Path, service: &str, state: &mut Value) {
    let Some(list) = state["backups"].as_array().cloned() else {
        return;
    };
    if list.len() <= MAX_BACKUPS {
        return;
    }
    let drop_count = list.len() - MAX_BACKUPS;
    for record in list.iter().take(drop_count) {
        if let Some(name) = record["path"].as_str() {
            let _ = fs::remove_file(store.join("backup").join(name));
        }
        if let Some(key_id) = record["keyId"].as_str()
            && let Ok(entry) = vault_entry(store, service, key_id)
        {
            let _ = entry.delete_credential();
        }
    }
    state["backups"] = json!(list[drop_count..].to_vec());
}

/// Puts backed-up bytes back after a failed write; reports rollbackFailed if that fails too.
fn rollback(
    home: &Path,
    spec: &AppSpec,
    keys: &KeyFn<'_>,
    backup: &Path,
    key_id: &str,
) -> Result<()> {
    let key = keys(key_id, false)?;
    let plaintext = unseal(&key, backup)?;
    let value: Value = serde_json::from_slice(&plaintext).map_err(|_| err("credentialInvalid"))?;
    let files = snapshot_files(&value)?;
    restore_blob_in(home, spec, &files).map_err(|_| err("rollbackFailed"))
}

/// Restores a saved account over the live session, with backup and verification.
fn apply_account(
    home: &Path,
    store: &Path,
    service: &str,
    spec: &AppSpec,
    keys: &KeyFn<'_>,
    state: &mut Value,
    id: &str,
) -> Result<()> {
    let index = account_index(state, id)?;
    if !blob_path(store, id).exists() {
        return Err(err("loginRequired"));
    }
    let key = keys(&format!("account|{id}"), false)?;
    let plaintext = unseal(&key, &blob_path(store, id))?;
    let blob: Value = serde_json::from_slice(&plaintext).map_err(|_| err("credentialInvalid"))?;
    let files = snapshot_files(&blob)?;

    // A blob captured on another machine cannot be decrypted by the app either.
    if let Some(expected) = blob["machineIdHash"].as_str()
        && machine_fingerprint_in(home, spec).as_deref() != Some(expected)
    {
        return Err(err("machineMismatch"));
    }
    // The app rewrites this file on login and token refresh, so a fingerprint change is
    // normal and must not block a switch. The mandatory backup below is what protects the
    // outgoing session; the UI surfaces `sessionChanged` so the user knows a backup is the
    // only copy of whatever account the app currently holds.

    let (backup, backup_key) = backup_current(home, store, service, spec, keys, state, "apply")?;
    let written = (|| -> Result<()> {
        restore_blob_in(home, spec, &files)?;
        if fingerprints_in(home, spec)? != hashes_of(&files) {
            return Err(err("switchFailed"));
        }
        Ok(())
    })();
    if let Err(error) = written {
        rollback(home, spec, keys, &backup, &backup_key)?;
        return Err(error);
    }

    state["activeId"] = json!(id);
    state["accounts"][index]["updatedAt"] = json!(now());
    state["fingerprints"] = hashes_value(&hashes_of(&files));
    state["notice"] = json!("switched");
    Ok(())
}

fn revert_last_backup(
    home: &Path,
    store: &Path,
    service: &str,
    spec: &AppSpec,
    keys: &KeyFn<'_>,
    state: &mut Value,
) -> Result<()> {
    let record = state["backups"]
        .as_array()
        .and_then(|list| list.last().cloned())
        .ok_or_else(|| err("noBackup"))?;
    let name = record["path"].as_str().ok_or_else(|| err("storage"))?;
    let key_id = record["keyId"].as_str().ok_or_else(|| err("storage"))?;
    let backup = store.join("backup").join(name);
    if !backup.exists() {
        return Err(err("noBackup"));
    }
    let key = keys(key_id, false)?;
    let plaintext = unseal(&key, &backup)?;
    let value: Value = serde_json::from_slice(&plaintext).map_err(|_| err("credentialInvalid"))?;
    let files = snapshot_files(&value)?;
    // Restoring is itself a write we must survive, so snapshot the current state first.
    let (safety, safety_key) = backup_current(home, store, service, spec, keys, state, "revert")?;
    if let Err(error) = restore_blob_in(home, spec, &files) {
        rollback(home, spec, keys, &safety, &safety_key)?;
        return Err(error);
    }
    state["fingerprints"] = hashes_value(&hashes_of(&files));
    state["notice"] = json!("reverted");
    Ok(())
}

fn snapshot_state(
    spec: &AppSpec,
    state: &Value,
    running: bool,
    files_present: bool,
    home: &Path,
) -> Value {
    let accounts: Vec<Value> = state["accounts"]
        .as_array()
        .cloned()
        .unwrap_or_default()
        .iter()
        .map(|account| {
            json!({
                "id": account["id"],
                "name": account["name"],
                "size": account["size"],
                "files": account["files"],
                "capturedAt": account["capturedAt"],
                "updatedAt": account["updatedAt"],
                "active": state["activeId"] == account["id"],
            })
        })
        .collect();
    let backups = state["backups"].as_array().cloned().unwrap_or_default();
    // True when the app rewrote its session since our last capture or switch, which means
    // the account the app currently holds is only preserved by the pre-switch backup.
    let session_changed = known_hashes(state)
        .is_some_and(|known| fingerprints_in(home, spec).map(|live| live != known).unwrap_or(false));
    json!({
        "app": spec.id,
        "accounts": accounts,
        "activeId": state["activeId"],
        "notice": state["notice"],
        "running": running,
        "filesPresent": files_present,
        "sessionChanged": session_changed,
        "sessionPath": home.to_string_lossy(),
        "managedFiles": spec.required.iter().chain(spec.optional).collect::<Vec<_>>(),
        "backupCount": backups.len(),
        "lastBackupAt": backups.last().and_then(|entry| entry["at"].as_i64()),
    })
}

// ---------------------------------------------------------------- app process

fn app_running(app: &tauri::AppHandle, spec: &AppSpec) -> bool {
    system::powershell(app, json!({"operation":"account-app-state","appId":spec.id}))
        .map(|state| state["running"] == true)
        .unwrap_or(false)
}

fn close_app(app: &tauri::AppHandle, spec: &AppSpec) -> Result<()> {
    system::powershell(app, json!({"operation":"account-app-close","appId":spec.id}))
        .map_err(|_| err("closeRequired"))?;
    Ok(())
}

fn open_app(app: &tauri::AppHandle, spec: &AppSpec) {
    // Reopening is best effort: the switch already landed, and a failed relaunch is
    // visible as the app not coming back rather than as a lost restore.
    let _ = system::powershell(app, json!({"operation":"account-app-open","appId":spec.id}));
}

// ---------------------------------------------------------------- command

pub fn handle(app: &tauri::AppHandle, app_id: &str, action: &str, payload: Value) -> Result<Value> {
    let mut guard = BROKER_LOCK.try_lock().map_err(|_| err("busy"))?;
    if guard.is_none() {
        *guard = Some(());
    }
    let spec = spec(app_id)?;
    let store = store_root(app, spec)?;
    let service = format!("{}-accounts", spec.id);
    let keys = |key_id: &str, create: bool| vault_key(&store, &service, key_id, create);
    let mut state = read_state(&store)?;
    let home = app_home(spec)?;
    let typed_name = |payload: &Value| -> String {
        payload["name"]
            .as_str()
            .unwrap_or("")
            .trim()
            .chars()
            .filter(|c| !c.is_control())
            .take(120)
            .collect()
    };
    let running = app_running(app, spec);
    let files_present = spec.required.iter().all(|file| home.join(file).exists());

    match action {
        "list" => {}
        "capture" => {
            if running {
                return Err(err("closeRequired"));
            }
            capture_account(&home, &store, spec, &keys, &mut state, &typed_name(&payload))?;
            state["notice"] = json!("captured");
            write_state(&store, &state)?;
        }
        "apply" => {
            let id = payload["id"].as_str().ok_or_else(|| err("unknownAccount"))?;
            if !is_valid_id(spec, id) {
                return Err(err("unknownAccount"));
            }
            if running {
                close_app(app, spec)?;
            }
            let result = apply_account(&home, &store, &service, spec, &keys, &mut state, id);
            // Persist whatever the attempt learned, including the automatic backup.
            write_state(&store, &state)?;
            if running {
                open_app(app, spec);
            }
            result?;
        }
        "revert" => {
            if running {
                return Err(err("closeRequired"));
            }
            revert_last_backup(&home, &store, &service, spec, &keys, &mut state)?;
            write_state(&store, &state)?;
        }
        "rename" => {
            let id = payload["id"].as_str().ok_or_else(|| err("unknownAccount"))?;
            let label = typed_name(&payload);
            if label.is_empty() {
                return Err(err("invalidName"));
            }
            let index = account_index(&state, id)?;
            state["accounts"][index]["name"] = json!(label);
            state["accounts"][index]["updatedAt"] = json!(now());
            write_state(&store, &state)?;
        }
        "delete" => {
            let id = payload["id"].as_str().ok_or_else(|| err("unknownAccount"))?;
            if !is_valid_id(spec, id) {
                return Err(err("unknownAccount"));
            }
            let index = account_index(&state, id)?;
            let blob = blob_path(&store, id);
            if blob.exists() {
                fs::remove_file(&blob).map_err(|_| err("storage"))?;
            }
            if let Ok(entry) = vault_entry(&store, &service, &format!("account|{id}")) {
                let _ = entry.delete_credential();
            }
            if let Some(parent) = blob.parent() {
                let _ = fs::remove_dir(parent);
            }
            state["accounts"]
                .as_array_mut()
                .ok_or_else(|| err("storage"))?
                .remove(index);
            if state["activeId"] == json!(id) {
                state["activeId"] = Value::Null;
            }
            write_state(&store, &state)?;
        }
        "dismiss" => {
            state["notice"] = Value::Null;
            write_state(&store, &state)?;
        }
        _ => return Err(err("unsupportedAction")),
    }

    // Re-read the process state: a switch reopens the app, and the UI badge must reflect
    // what the user now sees rather than what was true when the command started.
    let running_now = app_running(app, spec);
    Ok(snapshot_state(spec, &state, running_now, files_present, &home))
}

#[cfg(test)]
mod tests {
    use super::*;
    use age::secrecy::SecretString;
    use std::sync::atomic::{AtomicU64, Ordering};

    struct Sandbox {
        root: PathBuf,
    }
    impl Sandbox {
        fn new(tag: &str) -> Self {
            static NEXT: AtomicU64 = AtomicU64::new(0);
            let root = std::env::temp_dir().join(format!(
                "vibehub-app-accounts-{tag}-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&root).unwrap();
            Self { root }
        }
        fn home(&self) -> PathBuf {
            self.root.join("home")
        }
        fn store(&self) -> PathBuf {
            let store = self.root.join("store");
            fs::create_dir_all(store.join("backup")).unwrap();
            store
        }
        fn write(&self, name: &str, bytes: &[u8]) {
            fs::create_dir_all(self.home()).unwrap();
            fs::write(self.home().join(name), bytes).unwrap();
        }
        fn read(&self, name: &str) -> Vec<u8> {
            fs::read(self.home().join(name)).unwrap()
        }
    }
    impl Drop for Sandbox {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    const TEST_SERVICE: &str = "test-accounts";

    /// One fixed key stands in for the Credential Manager during tests.
    fn test_keys(_id: &str, _create: bool) -> Result<SecretString> {
        Ok(SecretString::from("test-key-material".to_owned()))
    }

    fn zcode() -> &'static AppSpec {
        spec("zcode").unwrap()
    }
    fn qoder() -> &'static AppSpec {
        spec("qoder").unwrap()
    }

    #[test]
    fn capture_then_restore_returns_identical_bytes() {
        let sandbox = Sandbox::new("roundtrip");
        let app = zcode();
        let store = sandbox.store();
        let original = b"{\"oauth:zai:access_token\":\"opaque\"}".to_vec();
        sandbox.write("credentials.json", &original);
        sandbox.write("credential-source", b"os");
        let mut state = json!({"accounts":[],"backups":[],"activeId":null});

        let id = capture_account(&sandbox.home(), &store, app, &test_keys, &mut state, "").unwrap();
        assert!(is_valid_id(app, &id));
        sandbox.write("credentials.json", b"{\"other\":true}");

        apply_account(&sandbox.home(), &store, TEST_SERVICE, app, &test_keys, &mut state, &id).unwrap();
        assert_eq!(sandbox.read("credentials.json"), original);
        assert_eq!(sandbox.read("credential-source"), b"os");
        assert_eq!(state["activeId"], json!(id));
        assert_eq!(state["notice"], json!("switched"));
        assert_eq!(state["backups"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn recapturing_the_same_session_reuses_the_account_id() {
        let sandbox = Sandbox::new("dedupe");
        let store = sandbox.store();
        sandbox.write("credentials.json", b"same");
        let mut state = json!({"accounts":[],"backups":[],"activeId":null});
        let first = capture_account(&sandbox.home(), &store, zcode(), &test_keys, &mut state, "work").unwrap();
        let second = capture_account(&sandbox.home(), &store, zcode(), &test_keys, &mut state, "").unwrap();
        assert_eq!(first, second);
        assert_eq!(state["accounts"].as_array().unwrap().len(), 1);
        // A recapture keeps the name the user gave it.
        assert_eq!(state["accounts"][0]["name"], json!("work"));
    }

    #[test]
    fn a_session_changed_by_the_app_is_backed_up_before_it_is_replaced() {
        let sandbox = Sandbox::new("changed");
        let app = zcode();
        let store = sandbox.store();
        sandbox.write("credentials.json", b"state-a");
        let mut state = json!({"accounts":[],"backups":[],"activeId":null});
        let id = capture_account(&sandbox.home(), &store, app, &test_keys, &mut state, "").unwrap();
        // Logging into another account rewrites the file; that must not block a switch,
        // but the account being replaced must survive in the automatic backup.
        sandbox.write("credentials.json", b"state-b-uncaptured");

        apply_account(&sandbox.home(), &store, TEST_SERVICE, app, &test_keys, &mut state, &id).unwrap();
        assert_eq!(sandbox.read("credentials.json"), b"state-a");

        let backup_name = state["backups"][0]["path"].as_str().unwrap();
        let backup_key_id = state["backups"][0]["keyId"].as_str().unwrap();
        let key = test_keys(backup_key_id, false).unwrap();
        let plaintext = unseal(&key, &store.join("backup").join(backup_name)).unwrap();
        let blob: Value = serde_json::from_slice(&plaintext).unwrap();
        let files = snapshot_files(&blob).unwrap();
        assert_eq!(files[0].1, b"state-b-uncaptured");
    }

    #[test]
    fn the_snapshot_reports_when_the_app_rewrote_the_session() {
        let sandbox = Sandbox::new("changed-flag");
        let app = zcode();
        let store = sandbox.store();
        sandbox.write("credentials.json", b"state-a");
        let mut state = json!({"accounts":[],"backups":[],"activeId":null});
        capture_account(&sandbox.home(), &store, app, &test_keys, &mut state, "").unwrap();
        assert!(!snapshot_state(app, &state, false, true, &sandbox.home())["sessionChanged"]
            .as_bool()
            .unwrap());
        sandbox.write("credentials.json", b"state-b");
        assert!(snapshot_state(app, &state, false, true, &sandbox.home())["sessionChanged"]
            .as_bool()
            .unwrap());
    }

    #[test]
    fn a_foreign_machine_snapshot_is_refused() {
        let sandbox = Sandbox::new("machine");
        let app = qoder();
        let store = sandbox.store();
        sandbox.write("auth.v1.dat", b"blob");
        sandbox.write("auth.machine-id", b"machine-one");
        let mut state = json!({"accounts":[],"backups":[],"activeId":null});
        let id = capture_account(&sandbox.home(), &store, app, &test_keys, &mut state, "").unwrap();

        // A different machine id means the app cannot decrypt this blob here.
        sandbox.write("auth.machine-id", b"machine-two");
        let error = apply_account(&sandbox.home(), &store, TEST_SERVICE, app, &test_keys, &mut state, &id).unwrap_err();
        assert_eq!(error, err("machineMismatch"));
        assert_eq!(sandbox.read("auth.v1.dat"), b"blob");
    }

    #[test]
    fn missing_session_files_mean_not_signed_in() {
        let sandbox = Sandbox::new("missing");
        let mut state = json!({"accounts":[],"backups":[],"activeId":null});
        assert_eq!(
            capture_account(&sandbox.home(), &sandbox.store(), zcode(), &test_keys, &mut state, "").unwrap_err(),
            err("loginRequired")
        );
    }

    #[test]
    fn revert_restores_the_last_backup_and_keeps_a_safety_copy() {
        let sandbox = Sandbox::new("revert");
        let app = zcode();
        let store = sandbox.store();
        sandbox.write("credentials.json", b"first");
        let mut state = json!({"accounts":[],"backups":[],"activeId":null});
        capture_account(&sandbox.home(), &store, app, &test_keys, &mut state, "").unwrap();
        sandbox.write("credentials.json", b"second");
        let second = capture_account(&sandbox.home(), &store, app, &test_keys, &mut state, "").unwrap();
        // Switch so a backup of "first" exists, then revert to it.
        let first = state["accounts"][0]["id"].as_str().unwrap().to_owned();
        apply_account(&sandbox.home(), &store, TEST_SERVICE, app, &test_keys, &mut state, &first).unwrap();
        revert_last_backup(&sandbox.home(), &store, TEST_SERVICE, app, &test_keys, &mut state).unwrap();
        assert_eq!(sandbox.read("credentials.json"), b"second");
        assert_ne!(first, second);
        // The revert itself was backed up, so the list grew by one more.
        assert!(state["backups"].as_array().unwrap().len() >= 2);
    }

    #[test]
    fn backups_are_pruned_to_the_cap() {
        let sandbox = Sandbox::new("prune");
        let app = zcode();
        let store = sandbox.store();
        sandbox.write("credentials.json", b"payload");
        let mut state = json!({"accounts":[],"backups":[],"activeId":null});
        for index in 0..MAX_BACKUPS + 3 {
            sandbox.write("credentials.json", format!("payload-{index}").as_bytes());
            backup_current(&sandbox.home(), &store, TEST_SERVICE, app, &test_keys, &mut state, "apply").unwrap();
        }
        assert_eq!(state["backups"].as_array().unwrap().len(), MAX_BACKUPS);
        let files = fs::read_dir(store.join("backup")).unwrap().count();
        assert_eq!(files, MAX_BACKUPS);
    }

    #[test]
    fn ids_must_match_the_app_namespace_and_stay_path_safe() {
        assert!(is_valid_id(zcode(), "zcode-0123456789abcdef01234567"));
        for bad in ["", "qoder-0123456789abcdef01234567", "zcode-", "zcode-../../etc", "zcode-a/b"] {
            assert!(!is_valid_id(zcode(), bad), "{bad} must be rejected");
        }
    }

    #[test]
    fn snapshot_payloads_reject_traversal_empty_sets_and_unknown_files() {
        assert!(files_from_value(&json!({})).is_err());
        assert!(files_from_value(&json!({"../escape": "AAAA"})).is_err());
        assert!(files_from_value(&json!({"ok.json": "AAAA"})).is_ok());
        // A tampered blob must not be able to write a file the app never declared.
        let error = restore_blob_in(&Sandbox::new("tamper").home(), zcode(), &[("settings.json".into(), b"x".to_vec())]).unwrap_err();
        assert_eq!(error, err("credentialInvalid"));
    }

    #[test]
    fn the_app_file_sets_stay_minimal_and_explicit() {
        // Regression guard: adding a settings file here would roll back user preferences.
        assert_eq!(zcode().required, &["credentials.json"]);
        assert_eq!(zcode().optional, &["credential-source"]);
        assert_eq!(qoder().required, &["auth.v1.dat"]);
        assert_eq!(qoder().optional, &["auth-profile-overlays.v1.dat"]);
        assert!(!zcode().required.contains(&"provider_config.json"));
    }
}
