use crate::domain::{Result, field, identifier, validate_config, validate_profile};
use serde_json::{Value, json};
use std::{fs, path::Path, sync::Mutex};
use tauri::Manager;

pub static SETTINGS_LOCK: Mutex<()> = Mutex::new(());

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
    validate_profile(&profile)?;
    let id = field(&profile, "id")?.to_owned();
    let mut state = load(path)?;
    let profiles = state["profiles"].as_array_mut().ok_or("Invalid profiles")?;
    let service = format!("vibehub.proxy.{id}");
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
