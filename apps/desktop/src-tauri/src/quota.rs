//! Daily quota for the coding apps that publish one.
//!
//! The numbers are read from inside the running app: the RTL injector that
//! already holds a DevTools connection answers on a loopback port. Nothing here
//! reads a session file, and no token reaches this module or the webview —
//! only the counters the app itself produced.

use crate::domain::Result;
use serde_json::{Value, json};
use std::{fs, path::{Path, PathBuf}, sync::Mutex, time::Duration};
use tauri::Manager;

/// Apps that publish a daily quota, and the process names that mean "running".
const APPS: &[AppSpec] = &[
    AppSpec {
        id: "qoder",
        processes: &["qoder.exe", "qoder ide.exe", "qoderai.exe"],
    },
    AppSpec {
        id: "minimax-code",
        processes: &["minimax code.exe"],
    },
];

struct AppSpec {
    id: &'static str,
    processes: &'static [&'static str],
}

/// The only statuses the UI knows how to render.
const STATUSES: [&str; 6] = [
    "ok",
    "signedOut",
    "appNotRunning",
    "notLaunchedByVibeHub",
    "unsupported",
    "error",
];

/// Keeps two probes for the same app from running at once.
static IN_FLIGHT: Mutex<Vec<String>> = Mutex::new(Vec::new());
/// The cache holds counters only, so a short lock around it is enough.
static CACHE_LOCK: Mutex<()> = Mutex::new(());

fn err(key: &str) -> String {
    format!("quota:{key}")
}

fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

fn spec(app_id: &str) -> Result<&'static AppSpec> {
    APPS.iter()
        .find(|entry| entry.id == app_id)
        .ok_or_else(|| err("unsupportedApp"))
}

/// Where the injector of a running app publishes its quota port.
fn runtime_file(app_id: &str) -> Option<PathBuf> {
    let base = std::env::var_os("LOCALAPPDATA")?;
    Some(
        PathBuf::from(base)
            .join("VibeHub")
            .join("rtl")
            .join(format!("{app_id}.json")),
    )
}

/// The port the app's injector answers on, when it runs under VibeHub.
fn runtime_port(app_id: &str) -> Option<u16> {
    let path = runtime_file(app_id)?;
    runtime_port_from(&path, app_id)
}

/// Reads the injector registration file. A file that names another app, or a
/// port outside the usable range, is ignored.
fn runtime_port_from(path: &Path, app_id: &str) -> Option<u16> {
    let bytes = fs::read(path).ok()?;
    let value: Value = serde_json::from_slice(&bytes).ok()?;
    if value["appId"].as_str() != Some(app_id) {
        return None;
    }
    let port = value["quotaPort"].as_u64()?;
    if !(1024..=65535).contains(&port) {
        return None;
    }
    Some(port as u16)
}

/// Whether the app runs at all, launched by VibeHub or by its own icon.
fn process_running(spec: &AppSpec) -> bool {
    let Ok(output) = std::process::Command::new("tasklist")
        .args(["/FO", "CSV", "/NH"])
        .output()
    else {
        return false;
    };
    let text = String::from_utf8_lossy(&output.stdout).to_lowercase();
    spec.processes.iter().any(|name| text.contains(name))
}

// ---------------------------------------------------------------- cache

fn cache_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    app.path()
        .app_config_dir()
        .map(|path| path.join("quota.json"))
        .map_err(|e| e.to_string())
}

fn read_cache(app: &tauri::AppHandle) -> Value {
    let Ok(path) = cache_path(app) else {
        return json!({ "apps": {} });
    };
    let _guard = CACHE_LOCK.lock();
    crate::storage::read(&path, json!({ "apps": {} })).unwrap_or(json!({ "apps": {} }))
}

fn cached_entry(app: &tauri::AppHandle, app_id: &str) -> Value {
    let cache = read_cache(app);
    cache["apps"][app_id].clone()
}

fn write_cache(app: &tauri::AppHandle, app_id: &str, entry: &Value) {
    let Ok(path) = cache_path(app) else {
        return;
    };
    let _guard = CACHE_LOCK.lock();
    let mut cache = crate::storage::read(&path, json!({ "apps": {} })).unwrap_or(json!({ "apps": {} }));
    cache["apps"][app_id] = entry.clone();
    let _ = crate::storage::write(&path, &cache);
}

// ---------------------------------------------------------------- shape

fn number(value: &Value, key: &str) -> Option<f64> {
    value
        .get(key)
        .and_then(Value::as_f64)
        .map(|n| (n * 100.0).round() / 100.0)
}

/// Copies the whitelisted counters out of an answer. Anything else — account
/// details, headers, tokens — is dropped here and never stored.
fn unit_of(value: Option<&Value>) -> String {
    value
        .and_then(Value::as_str)
        .filter(|value| {
            !value.is_empty() && value.len() <= 16 && value.chars().all(|c| c.is_ascii_alphanumeric())
        })
        .unwrap_or("credits")
        .to_string()
}

fn normalize(app_id: &str, raw: &Value) -> Value {
    let status = raw
        .get("status")
        .and_then(Value::as_str)
        .filter(|value| STATUSES.contains(value))
        .unwrap_or("error");
    let claim = raw.get("claim").cloned().unwrap_or(Value::Null);
    let unit = unit_of(raw.get("unit"));
    // The plan allowance stays next to the daily credits; they are never merged.
    let plan = raw
        .get("plan")
        .filter(|value| value.is_object())
        .map(|value| {
            json!({
                "used": number(value, "used"),
                "total": number(value, "total"),
                "remaining": number(value, "remaining"),
                "percent": number(value, "percent"),
                "unit": unit_of(value.get("unit")),
            })
        })
        .unwrap_or(Value::Null);
    json!({
        "appId": app_id,
        "status": status,
        "used": number(raw, "used"),
        "total": number(raw, "total"),
        "remaining": number(raw, "remaining"),
        "percent": number(raw, "percent"),
        "unit": unit,
        "plan": plan,
        "resetsAt": raw.get("resetsAt").and_then(Value::as_i64),
        "checkedAt": now(),
        "claim": {
            "available": claim.get("available").and_then(Value::as_bool).unwrap_or(false),
            "claimed": claim.get("claimed").and_then(Value::as_bool),
            "points": claim.get("points").and_then(Value::as_f64),
            "dayNo": claim.get("dayNo").and_then(Value::as_f64),
        },
        "error": raw
            .get("error")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty() && value.len() <= 40),
    })
}

/// The last known counters with a new status, so a failed check never blanks
/// the card.
fn with_status(app: &tauri::AppHandle, app_id: &str, status: &str, code: Option<&str>) -> Value {
    let mut raw = cached_entry(app, app_id);
    if !raw.is_object() {
        raw = json!({});
    }
    raw["status"] = json!(status);
    raw["error"] = match code {
        Some(value) => json!(value),
        None => Value::Null,
    };
    normalize(app_id, &raw)
}

/// What we can say without talking to the app.
fn availability(app: &tauri::AppHandle, app_id: &str) -> Value {
    let Ok(spec) = spec(app_id) else {
        return json!({});
    };
    if runtime_port(app_id).is_some() {
        // The injector is registered but did not answer: the app is gone.
        return with_status(app, app_id, "appNotRunning", Some("appNotRunning"));
    }
    if process_running(spec) {
        return with_status(app, app_id, "notLaunchedByVibeHub", Some("notLaunchedByVibeHub"));
    }
    with_status(app, app_id, "appNotRunning", Some("appNotRunning"))
}

// ---------------------------------------------------------------- transport

async fn call(port: u16, path: &str, method: &str) -> Result<Value> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let client = reqwest::Client::builder()
        // The answer comes from this machine; a configured proxy must not touch it.
        .no_proxy()
        .timeout(Duration::from_secs(25))
        .connect_timeout(Duration::from_secs(3))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| err("networkUnavailable"))?;
    let url = format!("http://127.0.0.1:{port}{path}");
    let request = if method == "POST" {
        client.post(&url)
    } else {
        client.get(&url)
    };
    let response = request.send().await.map_err(|error| {
        if error.is_connect() {
            err("appNotRunning")
        } else if error.is_timeout() {
            err("timeout")
        } else {
            err("probeFailed")
        }
    })?;
    if !response.status().is_success() {
        return Err(err("probeFailed"));
    }
    let bytes = response.bytes().await.map_err(|_| err("probeFailed"))?;
    if bytes.len() > 64 * 1024 {
        return Err(err("probeFailed"));
    }
    serde_json::from_slice(&bytes).map_err(|_| err("probeFailed"))
}

/// Only the injector of this app may answer: a stale port or another local
/// service must never be read as a quota.
fn is_our_service(raw: &Value, app_id: &str) -> bool {
    raw["service"].as_str() == Some("vibehub-quota") && raw["appId"].as_str() == Some(app_id)
}

// ---------------------------------------------------------------- probes

async fn probe(app: &tauri::AppHandle, app_id: &str) -> Value {
    let Some(port) = runtime_port(app_id) else {
        return availability(app, app_id);
    };
    match call(port, "/quota", "GET").await {
        Ok(raw) if is_our_service(&raw, app_id) => {
            let entry = normalize(app_id, &raw);
            write_cache(app, app_id, &entry);
            entry
        }
        Ok(_) => {
            let entry = with_status(app, app_id, "appNotRunning", Some("appNotRunning"));
            write_cache(app, app_id, &entry);
            entry
        }
        Err(error) => {
            let code = error.rsplit(':').next().unwrap_or("probeFailed");
            let entry = with_status(app, app_id, "error", Some(code));
            write_cache(app, app_id, &entry);
            entry
        }
    }
}

/// One probe per app at a time.
struct Flight(String);

impl Flight {
    fn begin(app_id: &str) -> Result<Self> {
        let mut list = IN_FLIGHT.lock().map_err(|_| err("busy"))?;
        if list.iter().any(|id| id == app_id) {
            return Err(err("busy"));
        }
        list.push(app_id.to_string());
        Ok(Flight(app_id.to_string()))
    }
}

impl Drop for Flight {
    fn drop(&mut self) {
        if let Ok(mut list) = IN_FLIGHT.lock() {
            list.retain(|id| id != &self.0);
        }
    }
}

fn entries(app: &tauri::AppHandle) -> Vec<Value> {
    let cache = read_cache(app);
    APPS.iter()
        .map(|spec| {
            let entry = cache["apps"][spec.id].clone();
            if entry.is_object() {
                entry
            } else {
                json!({
                    "appId": spec.id,
                    "status": "appNotRunning",
                    "used": Value::Null,
                    "total": Value::Null,
                    "remaining": Value::Null,
                    "percent": Value::Null,
                    "unit": "credits",
                    "resetsAt": Value::Null,
                    "checkedAt": Value::Null,
                    "claim": { "available": false, "claimed": Value::Null, "points": Value::Null, "dayNo": Value::Null },
                    "error": Value::Null,
                })
            }
        })
        .collect()
}

fn snapshot(app: &tauri::AppHandle) -> Value {
    json!({ "nativePreview": false, "apps": entries(app) })
}

// ---------------------------------------------------------------- command

pub async fn handle(app: &tauri::AppHandle, action: &str, payload: Value) -> Result<Value> {
    match action {
        "list" => {
            let mut apps = Vec::new();
            for spec in APPS {
                let entry = cached_entry(app, spec.id);
                let entry = if entry.is_object() {
                    entry
                } else if let Ok(_flight) = Flight::begin(spec.id) {
                    // The first read happens here so the page opens with real numbers.
                    probe(app, spec.id).await
                } else {
                    availability(app, spec.id)
                };
                apps.push(entry);
            }
            Ok(json!({ "nativePreview": false, "apps": apps }))
        }
        "refresh" => {
            let app_id = payload["appId"]
                .as_str()
                .ok_or_else(|| err("unsupportedApp"))?
                .to_string();
            spec(&app_id)?;
            let _flight = Flight::begin(&app_id)?;
            probe(app, &app_id).await;
            Ok(snapshot(app))
        }
        "claim" => {
            let app_id = payload["appId"]
                .as_str()
                .ok_or_else(|| err("unsupportedApp"))?
                .to_string();
            spec(&app_id)?;
            let _flight = Flight::begin(&app_id)?;
            let Some(port) = runtime_port(&app_id) else {
                let entry = availability(app, &app_id);
                write_cache(app, &app_id, &entry);
                return Ok(json!({
                    "nativePreview": false,
                    "apps": entries(app),
                    "claim": { "appId": app_id, "ok": false, "error": "appNotRunning", "points": Value::Null, "dayNo": Value::Null },
                }));
            };
            let outcome = match call(port, "/claim", "POST").await {
                Ok(raw) if is_our_service(&raw, &app_id) => {
                    let ok = raw["ok"].as_bool().unwrap_or(false);
                    let code = raw["error"].as_str().unwrap_or("").to_string();
                    if !ok && !code.is_empty() {
                        Err(code)
                    } else {
                        Ok(raw)
                    }
                }
                Ok(_) => Err("appNotRunning".to_string()),
                Err(error) => Err(error.rsplit(':').next().unwrap_or("claimFailed").to_string()),
            };
            match outcome {
                Ok(raw) => {
                    // Claiming changes the balance, so read the counters again.
                    let entry = probe(app, &app_id).await;
                    write_cache(app, &app_id, &entry);
                    Ok(json!({
                        "nativePreview": false,
                        "apps": entries(app),
                        "claim": {
                            "appId": app_id,
                            "ok": true,
                            "error": Value::Null,
                            "points": raw["points"].as_f64(),
                            "dayNo": raw["dayNo"].as_f64(),
                        },
                    }))
                }
                Err(code) => {
                    // A refused claim is not a broken quota: the counters stay
                    // as they are and only the notice reports the refusal.
                    let entry = probe(app, &app_id).await;
                    write_cache(app, &app_id, &entry);
                    Ok(json!({
                        "nativePreview": false,
                        "apps": entries(app),
                        "claim": { "appId": app_id, "ok": false, "error": code, "points": Value::Null, "dayNo": Value::Null },
                    }))
                }
            }
        }
        _ => Err(err("unsupportedAction")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_whitelisted_counters_survive_normalization() {
        let raw = json!({
            "status": "ok",
            "used": 12.345,
            "total": 100,
            "remaining": 88,
            "unit": "credits",
            "resetsAt": 1794000000,
            "claim": { "available": true, "claimed": false, "points": 5, "dayNo": 2 },
            "email": "someone@example.invalid",
            "accessToken": "secret-value",
            "authorization": "Bearer secret-value"
        });
        let entry = normalize("qoder", &raw);
        assert_eq!(entry["status"], json!("ok"));
        assert_eq!(entry["used"], json!(12.35));
        assert_eq!(entry["total"], json!(100.0));
        assert_eq!(entry["remaining"], json!(88.0));
        assert_eq!(entry["claim"]["points"], json!(5.0));
        let text = entry.to_string();
        assert!(!text.contains("secret-value"));
        assert!(!text.contains("example.invalid"));
        assert!(!text.to_lowercase().contains("token"));
        assert!(!text.to_lowercase().contains("authorization"));
    }

    #[test]
    fn unknown_statuses_fall_back_to_error() {
        let entry = normalize("qoder", &json!({ "status": "something-else", "total": 10 }));
        assert_eq!(entry["status"], json!("error"));
        assert_eq!(entry["total"], json!(10.0));
    }

    #[test]
    fn a_unit_that_is_not_a_word_is_rejected() {
        let entry = normalize("qoder", &json!({ "status": "ok", "unit": "credits; drop table" }));
        assert_eq!(entry["unit"], json!("credits"));
    }

    #[test]
    fn only_known_apps_are_served() {
        assert!(spec("qoder").is_ok());
        assert!(spec("minimax-code").is_ok());
        assert!(spec("zcode").is_err());
        assert!(spec("../etc").is_err());
    }

    #[test]
    fn only_our_own_injector_is_trusted() {
        assert!(is_our_service(
            &json!({ "service": "vibehub-quota", "appId": "qoder" }),
            "qoder"
        ));
        assert!(!is_our_service(&json!({ "service": "vibehub-quota", "appId": "zcode" }), "qoder"));
        assert!(!is_our_service(&json!({ "appId": "qoder" }), "qoder"));
        assert!(!is_our_service(&json!({ "service": "something-else", "appId": "qoder" }), "qoder"));
    }

    #[test]
    fn the_injector_registration_names_the_port() {
        let file = std::env::temp_dir().join("vibehub-quota-port-test.json");
        fs::write(&file, br#"{"appId":"qoder","quotaPort":9227,"pid":42}"#).unwrap();
        assert_eq!(runtime_port_from(&file, "qoder"), Some(9227));
        assert_eq!(runtime_port_from(&file, "minimax-code"), None);
        fs::write(&file, br#"{"appId":"qoder","quotaPort":80}"#).unwrap();
        assert_eq!(runtime_port_from(&file, "qoder"), None);
        fs::write(&file, b"not json").unwrap();
        assert_eq!(runtime_port_from(&file, "qoder"), None);
        let _ = fs::remove_file(&file);
    }
}
