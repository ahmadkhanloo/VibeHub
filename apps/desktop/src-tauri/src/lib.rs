mod accounts;
mod domain;
mod network;
mod storage;
mod system;

use domain::{APP_IDS, EDITOR_IDS, Result};
use serde_json::{Value, json};
use tauri::Manager;

#[tauri::command]
async fn codex_accounts(app: tauri::AppHandle, action: String, payload: Value) -> Result<Value> {
    system::blocking(move || accounts::handle(&app, &action, payload)).await
}

#[tauri::command]
async fn app_path(app: tauri::AppHandle, app_id: String, path: String) -> Result<()> {
    if !APP_IDS.contains(&app_id.as_str()) { return Err("Unsupported app path".into()); }
    system::run(app, json!({"operation":"app-path", "appId":app_id, "path":path})).await?;
    Ok(())
}

#[tauri::command]
async fn detect_apps(app: tauri::AppHandle) -> Result<Value> {
    system::run(app, json!({"operation":"detect"})).await
}

#[tauri::command]
async fn detect_editors(app: tauri::AppHandle) -> Result<Value> {
    system::run(app, json!({"operation":"detect-editors"})).await
}

#[tauri::command]
async fn rtl_components(app: tauri::AppHandle) -> Result<Value> {
    system::run(app, json!({"operation":"rtl-components"})).await
}

#[tauri::command]
async fn focus_editor(app: tauri::AppHandle, editor_id: String) -> Result<Value> {
    if !EDITOR_IDS.contains(&editor_id.as_str()) {
        return Err("Unknown supported editor".into());
    }
    system::run(app, json!({"operation":"focus-editor", "editorId":editor_id})).await
}

#[tauri::command]
async fn rtl_setup(app: tauri::AppHandle, app_id: String) -> Result<Value> {
    if !["qoder", "zcode", "deepseek-harness", "opencode"].contains(&app_id.as_str()) {
        return Err("RTL is unavailable for this app".into());
    }
    system::run(app, json!({"operation":"rtl-setup", "appId":app_id})).await
}

#[tauri::command]
async fn launch_editor(
    app: tauri::AppHandle,
    editor_id: String,
    rtl: Option<bool>,
) -> Result<Value> {
    if !EDITOR_IDS.contains(&editor_id.as_str()) || rtl == Some(true) {
        return Err("Unsupported editor launch".into());
    }
    system::blocking(move || {
        storage::run_launch(&launch_file(&app)?, &editor_id, || {
            let mut request = launch_request(&app, &editor_id, None)?;
            request["operation"] = json!("launch-editor");
            request["editorId"] = json!(editor_id);
            request["rtl"] = json!(rtl.unwrap_or(false));
            system::powershell(&app, request)
        })
    })
    .await
}

#[tauri::command]
async fn proxy_list(app: tauri::AppHandle) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        Ok(storage::load(&storage::settings(&app)?)?["profiles"].clone())
    })
    .await
}
#[tauri::command]
async fn proxy_config(app: tauri::AppHandle) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        Ok(storage::load(&storage::settings(&app)?)?["config"].clone())
    })
    .await
}
#[tauri::command]
async fn proxy_save(
    app: tauri::AppHandle,
    profile: Value,
    password: Option<String>,
) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        storage::save_profile(&storage::settings(&app)?, profile, password)
    })
    .await
}
#[tauri::command]
async fn proxy_delete(app: tauri::AppHandle, id: String) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        storage::delete_profile(&storage::settings(&app)?, &id)
    })
    .await
}
#[tauri::command]
async fn proxy_set_config(app: tauri::AppHandle, cfg: Value) -> Result<()> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        let path = storage::settings(&app)?;
        let mut state = storage::load(&path)?;
        domain::validate_config(
            &cfg,
            state["profiles"].as_array().ok_or("Invalid profiles")?,
        )?;
        state["config"] = cfg;
        storage::write(&path, &state)
    })
    .await
}
#[tauri::command]
async fn proxy_test(profile: Value, level: String) -> Result<Value> {
    network::proxy_test(profile, level).await
}

#[tauri::command]
async fn vault_set(service: String, key: String) -> Result<()> {
    system::blocking(move || storage::vault_set(&service, &key)).await
}
#[tauri::command]
async fn vault_get(service: String) -> Result<Option<String>> {
    system::blocking(move || storage::vault_get(&service)).await
}
#[tauri::command]
async fn vault_delete(service: String) -> Result<()> {
    system::blocking(move || storage::vault_delete(&service)).await
}

#[tauri::command]
async fn provider_connections(app: tauri::AppHandle) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        storage::provider_connections(&storage::provider_connection_file(&app)?)
    })
    .await
}

#[tauri::command]
async fn provider_connection_save(
    app: tauri::AppHandle,
    connection: Value,
    key: Option<String>,
) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        domain::validate_provider_connection(&connection)?;
        let path = storage::provider_connection_file(&app)?;
        let id = domain::field(&connection, "id")?.to_owned();
        let connections = storage::provider_connections(&path)?;
        let previous = connections.as_array().and_then(|list| list.iter().find(|item| item["id"] == id));
        if previous.is_some_and(|previous| {
            previous["providerId"] != connection["providerId"]
                || previous["baseUrl"] != connection["baseUrl"]
                || key.as_deref().is_some_and(|value| !value.is_empty())
        }) {
            storage::clear_model_snapshots(&storage::provider_model_snapshots(&app)?, &[id])?;
        }
        storage::save_provider_connection(&path, connection, key.as_deref())
    })
    .await
}

#[tauri::command]
async fn provider_connection_delete(app: tauri::AppHandle, id: String) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        storage::clear_model_snapshots(&storage::provider_model_snapshots(&app)?, std::slice::from_ref(&id))?;
        storage::delete_provider_connection(&storage::provider_connection_file(&app)?, &id)
    })
    .await
}

#[tauri::command]
async fn provider_credentials_inventory(app: tauri::AppHandle) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        storage::provider_credentials_inventory(&storage::provider_connection_file(&app)?)
    })
    .await
}

#[tauri::command]
async fn provider_credentials_clear(
    app: tauri::AppHandle,
    connection_ids: Vec<String>,
    legacy_provider_ids: Vec<String>,
) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        storage::clear_model_snapshots(&storage::provider_model_snapshots(&app)?, &connection_ids)?;
        storage::provider_credentials_clear(
            &storage::provider_connection_file(&app)?,
            &connection_ids,
            &legacy_provider_ids,
        )
    })
    .await
}

#[tauri::command]
async fn provider_connection_preview_models(
    app: tauri::AppHandle,
    provider_id: String,
    base_url: String,
    key: Option<String>,
) -> Result<Value> {
    let http = system::blocking(move || {
        let (profile, _) = storage::selected_profile(&storage::settings(&app)?, "*", None)?;
        network::client(profile.as_ref())
    }).await?;
    network::connection_models(&provider_id, &base_url, http, key.as_deref()).await
}

#[tauri::command]
async fn provider_notes(app: tauri::AppHandle) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK.lock().map_err(|_| "Settings lock failed")?;
        let path = storage::provider_connection_file(&app)?.with_file_name("provider-notes.json");
        let notes = storage::read(&path, json!({}))?;
        if !notes.as_object().is_some_and(|entries| entries.values().all(Value::is_string)) { return Err("Invalid provider notes".into()); }
        Ok(notes)
    }).await
}

#[tauri::command]
async fn provider_note_save(app: tauri::AppHandle, target: String, note: String) -> Result<Value> {
    system::blocking(move || {
        if target.is_empty() || target.len() > 2048 || target.chars().any(char::is_control) || note.len() > 16000 {
            return Err("Invalid note".into());
        }
        let _lock = storage::SETTINGS_LOCK.lock().map_err(|_| "Settings lock failed")?;
        let path = storage::provider_connection_file(&app)?.with_file_name("provider-notes.json");
        let mut notes = storage::read(&path, json!({}))?;
        let entries = notes.as_object_mut().ok_or("Invalid provider notes")?;
        if note.trim().is_empty() { entries.remove(&target); } else { entries.insert(target, json!(note)); }
        storage::write(&path, &notes)?;
        Ok(notes)
    }).await
}

#[tauri::command]
async fn provider_connection_preview_test(app: tauri::AppHandle, connection: Value, key: Option<String>) -> Result<Value> {
    domain::validate_provider_connection(&connection)?;
    if let Some(secret) = key.as_deref().filter(|s| !s.is_empty()) { storage::validate_vault_secret(secret)?; }
    let http = system::blocking(move || {
        let (profile, _) = storage::selected_profile(&storage::settings(&app)?, "*", None)?;
        network::client(profile.as_ref())
    }).await?;
    let secret = if connection["providerId"] == "ollama" { None } else { key.filter(|s| !s.is_empty()) };
    network::connection_test_with_client(connection, http, secret).await
}

#[tauri::command]
async fn provider_connection_cached_models(app: tauri::AppHandle) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK.lock().map_err(|_| "Settings lock failed")?;
        storage::model_snapshots(&storage::provider_model_snapshots(&app)?).map(Value::Object)
    }).await
}

fn model_list_connection(app: &tauri::AppHandle, id: &str) -> Result<(Value, Option<String>)> {
    let connections = storage::provider_connections(&storage::provider_connection_file(app)?)?;
    let connection = connections.as_array()
        .and_then(|list| list.iter().find(|item| item["id"] == id))
        .cloned().ok_or("Provider connection does not exist")?;
    let secret = if connection["providerId"] == "ollama" {
        None
    } else {
        storage::vault_get(&format!("vibehub.provider-key.connection.{id}"))?
    };
    Ok((connection, secret))
}

#[tauri::command]
async fn provider_connection_models(app: tauri::AppHandle, id: String) -> Result<Value> {
    let (connection, http, secret) = {
        let app = app.clone();
        let id = id.clone();
        system::blocking(move || {
            let (connection, secret, profile) = {
                let _lock = storage::SETTINGS_LOCK.lock().map_err(|_| "Settings lock failed")?;
                let (connection, secret) = model_list_connection(&app, &id)?;
                let (profile, _) = storage::selected_profile(&storage::settings(&app)?, "*", None)?;
                (connection, secret, profile)
            };
            Ok((connection, network::client(profile.as_ref())?, secret))
        }).await?
    };
    let result = network::connection_models(
        domain::field(&connection, "providerId")?,
        domain::field(&connection, "baseUrl")?,
        http,
        secret.as_deref(),
    ).await?;
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK.lock().map_err(|_| "Settings lock failed")?;
        if model_list_connection(&app, &id)? != (connection, secret) {
            return Err("Connection changed during model refresh".into());
        }
        storage::save_model_snapshot(&storage::provider_model_snapshots(&app)?, id, result)
    }).await
}

#[tauri::command]
async fn provider_connection_test(app: tauri::AppHandle, id: String) -> Result<Value> {
    let (connection, profile) = tauri::async_runtime::spawn_blocking(move || {
        let path = storage::provider_connection_file(&app)?;
        let connections = storage::provider_connections(&path)?;
        let connection = connections
            .as_array()
            .and_then(|list| list.iter().find(|item| item["id"] == id))
            .cloned()
            .ok_or("Provider connection does not exist")?;
        let (profile, _) = storage::selected_profile(&storage::settings(&app)?, "*", None)?;
        Ok::<_, String>((connection, profile))
    })
    .await
    .map_err(|_| "Provider connection lookup failed")??;
    network::connection_test(connection, profile).await
}

#[tauri::command]
async fn terminal_detect(app: tauri::AppHandle) -> Result<Value> {
    system::run(app, json!({"operation":"terminal-detect"})).await
}
#[tauri::command]
async fn claude_persian_terminal(app: tauri::AppHandle, cwd: Option<String>, open: bool) -> Result<Value> {
    if let Some(path) = &cwd {
        if !std::path::Path::new(path).is_absolute() || !std::path::Path::new(path).is_dir() || path.contains(['"', '\n', '\r', '\0']) {
            return Err("Select an existing project directory".into());
        }
    }
    system::blocking(move || {
        let mut request = if open { launch_request(&app, "claude-code", None)? } else { json!({}) };
        request["operation"] = json!("claude-persian-terminal");
        request["cwd"] = json!(cwd);
        request["open"] = json!(open);
        system::powershell(&app, request)
    }).await
}
#[tauri::command]
async fn terminal_install_persian(app: tauri::AppHandle) -> Result<Value> {
    system::run(app, json!({"operation":"terminal-install-persian"})).await
}
#[tauri::command]
async fn terminal_install_ohmyposh(app: tauri::AppHandle) -> Result<Value> {
    system::install(app, "terminal".into(), "winget", None).await
}
#[tauri::command]
async fn terminal_install_font(app: tauri::AppHandle, which: String) -> Result<Value> {
    system::run(app, json!({"operation":"font-install", "which":which})).await
}
#[tauri::command]
async fn terminal_apply_theme(app: tauri::AppHandle) -> Result<Value> {
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = storage::TERMINAL_LOCK
            .lock()
            .map_err(|_| "Terminal lock failed")?;
        system::powershell(&app, json!({"operation":"terminal-apply"}))
    })
    .await
    .map_err(|_| "Terminal operation failed")?
}
#[tauri::command]
async fn terminal_undo(app: tauri::AppHandle) -> Result<Value> {
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = storage::TERMINAL_LOCK
            .lock()
            .map_err(|_| "Terminal lock failed")?;
        system::powershell(&app, json!({"operation":"terminal-undo"}))
    })
    .await
    .map_err(|_| "Terminal operation failed")?
}
#[tauri::command]
async fn doctor_run(app: tauri::AppHandle) -> Result<Value> {
    system::run(app, json!({"operation":"doctor"})).await
}
#[tauri::command]
async fn install_winget(app: tauri::AppHandle, app_id: String) -> Result<Value> {
    system::install(app, app_id, "winget", None).await
}
#[tauri::command]
async fn install_npm(app: tauri::AppHandle, app_id: String, package_name: String) -> Result<Value> {
    system::install(app, app_id, "npm", Some(package_name)).await
}

#[tauri::command]
async fn api_test(
    app: tauri::AppHandle,
    provider_id: String,
    base_url: String,
    model_id: String,
    key_service: String,
) -> Result<Value> {
    let lookup_app = app.clone();
    let (profile, _) = system::blocking(move || {
        storage::selected_profile(&storage::settings(&lookup_app)?, "*", None)
    })
    .await?;
    network::api_test(profile, provider_id, base_url, model_id, key_service).await
}
#[tauri::command]
async fn feed_sync(app: tauri::AppHandle, feed_base_url: String) -> Result<Value> {
    let lookup_app = app.clone();
    let (profile, _) = system::blocking(move || {
        storage::selected_profile(&storage::settings(&lookup_app)?, "*", None)
    })
    .await?;
    network::feed_sync(profile, feed_base_url).await
}

fn launch_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf> {
    app.path()
        .app_config_dir()
        .map(|p| p.join("launch.json"))
        .map_err(|e| e.to_string())
}

fn launch_request(app: &tauri::AppHandle, id: &str, override_id: Option<&str>) -> Result<Value> {
    let (profile, required) = {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
        storage::selected_profile(&storage::settings(app)?, id, override_id)?
    };
    let mut request = json!({});
    if let Some(profile) = profile {
        match profile["mode"].as_str() {
            Some("http" | "socks5") => {
                if required {
                    return Err("Required-proxy launch is blocked: this tool has no validated proxy adapter".into());
                }
                if profile["hasPassword"] == true
                    || profile["username"].as_str().is_some_and(|s| !s.is_empty())
                {
                    return Err("Authenticated child-process proxies are unsupported".into());
                }
                request["proxyUrl"] = json!(network::proxy_url(&profile)?);
            }
            Some("direct") => request["direct"] = json!(true),
            _ => (),
        }
    }
    Ok(request)
}

#[tauri::command]
async fn launch_app(app: tauri::AppHandle, req: Value) -> Result<Value> {
    launch_app_inner(app, req).await
}

/// Shared launch pipeline for the UI command and the tray quick-launch menu.
async fn launch_app_inner(app: tauri::AppHandle, req: Value) -> Result<Value> {
    let id = domain::field(&req, "appId")?.to_owned();
    if !APP_IDS.contains(&id.as_str()) || !req["rtl"].is_boolean() {
        return Err("Invalid launch request".into());
    }
    if let Some(cwd) = req.get("cwd") {
        let path = cwd.as_str().ok_or("Invalid project folder")?;
        let folder = std::path::Path::new(path);
        if !folder.is_absolute() || !folder.is_dir() || path.contains(['"', '\n', '\r', '\0']) {
            return Err("Project folder does not exist or has an invalid path".into());
        }
        if ["chatgpt", "claude-desktop"].contains(&id.as_str()) { return Err("This application does not support project folders".into()); }
    }
    if req["focus"].as_bool() == Some(true) {
        return system::blocking(move || system::powershell(&app, json!({"operation":"focus-app", "appId":id}))).await;
    }
    system::blocking(move || {
        storage::run_launch(&launch_file(&app)?, &id, || {
            let mut request = launch_request(&app, &id, req["proxyProfileId"].as_str())?;
            request["operation"] = json!("launch");
            if id == "claude-code" {
                if let Some(connection_id) = req["connectionId"].as_str() {
                    let connections = storage::provider_connections(&storage::provider_connection_file(&app)?)?;
                    let connection = connections.as_array().ok_or("Invalid connections")?.iter()
                        .find(|c| c["id"].as_str() == Some(connection_id)).ok_or("Selected connection no longer exists")?;
                    domain::validate_connection_model(domain::field(connection, "modelId")?)?;
                    let base = domain::field(connection, "baseUrl")?.trim_end_matches('/');
                    let provider = domain::field(connection, "providerId")?;
                    let requested_auth = if req["authHeader"] == "bearer" { "ANTHROPIC_AUTH_TOKEN" } else { "ANTHROPIC_API_KEY" };
                    let (claude_base, official_auth) = domain::claude_connection_endpoint(provider, base, requested_auth)?;
                    request["claudeBaseUrl"] = json!(claude_base);
                    request["claudeModel"] = connection["modelId"].clone();
                    request["claudeKey"] = json!(storage::vault_get(&format!("vibehub.provider-key.connection.{connection_id}"))?
                        .ok_or("Save an API key for this connection first")?);
                    request["claudeAuth"] = json!(official_auth);
                }
            }
            request["req"] = req;
            system::powershell(&app, request)
        })
    })
    .await
}

#[tauri::command]
async fn launch_states(app: tauri::AppHandle, app_ids: Vec<String>) -> Result<Value> {
    if app_ids.len() > APP_IDS.len() + EDITOR_IDS.len()
        || app_ids
            .iter()
            .any(|id| !APP_IDS.contains(&id.as_str()) && !EDITOR_IDS.contains(&id.as_str()))
    {
        return Err("Unknown tool in state request".into());
    }
    system::blocking(move || {
        let states = {
            let _lock = storage::LAUNCH_LOCK
                .lock()
                .map_err(|_| "Launch state lock failed")?;
            storage::read(&launch_file(&app)?, json!({}))?
        };
        let selected: serde_json::Map<String, Value> = app_ids
            .into_iter()
            .map(|id| {
                let value = states[&id].clone();
                (id, value)
            })
            .collect();
        system::powershell(
            &app,
            json!({"operation":"launch-states", "states":selected}),
        )
    })
    .await
}

#[tauri::command]
async fn launch_state(app: tauri::AppHandle, app_id: String) -> Result<Value> {
    let states = launch_states(app, vec![app_id.clone()]).await?;
    Ok(states[&app_id].clone())
}

#[tauri::command]
async fn stop_rtl(app: tauri::AppHandle, app_id: String) -> Result<Value> {
    if !APP_IDS.contains(&app_id.as_str()) && app_id != "antigravity" {
        return Err("Unknown RTL tool".into());
    }
    system::blocking(move || {
        let _operation = storage::LaunchOperation::begin(&app_id)?;
        let path = launch_file(&app)?;
        let state = {
            let _lock = storage::LAUNCH_LOCK
                .lock()
                .map_err(|_| "Launch state lock failed")?;
            storage::read(&path, json!({}))?[&app_id].clone()
        };
        if state.is_null() {
            return Ok(json!(false));
        }
        let result = system::powershell(&app, json!({"operation":"stop-rtl", "state":state}))?;
        let _lock = storage::LAUNCH_LOCK
            .lock()
            .map_err(|_| "Launch state lock failed")?;
        let mut states = storage::read(&path, json!({}))?;
        states
            .as_object_mut()
            .ok_or("Invalid launch state")?
            .remove(&app_id);
        storage::write(&path, &states)?;
        Ok(result)
    })
    .await
}

#[tauri::command]
fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Tray quick-launch menu: Open, an "RTL launchers" submenu with one entry per
/// RTL-capable app (● marks running ones), Quit.
fn tray_menu(
    app: &tauri::AppHandle,
    apps: &[(String, String, bool)],
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    use tauri::menu::{IsMenuItem, Menu, MenuItem, Submenu};
    let open = MenuItem::with_id(app, "open", "Open / باز کردن", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit / خروج", true, None::<&str>)?;
    if apps.is_empty() {
        return Menu::with_items(app, &[&open, &quit]);
    }
    let mut children: Vec<MenuItem<tauri::Wry>> = Vec::new();
    for (id, label, running) in apps {
        children.push(MenuItem::with_id(
            app,
            format!("rtl:{id}"),
            if *running { format!("● {label}") } else { label.clone() },
            true,
            None::<&str>,
        )?);
    }
    let refs: Vec<&dyn IsMenuItem<tauri::Wry>> =
        children.iter().map(|item| item as &dyn IsMenuItem<tauri::Wry>).collect();
    let launchers = Submenu::with_id_and_items(
        app,
        "rtl-launchers",
        "اجراگرهای RTL / RTL launchers",
        true,
        &refs,
    )?;
    Menu::with_items(app, &[&open, &launchers, &quit])
}

/// The frontend pushes its detected RTL-capable inventory after every scan so
/// the always-visible tray stays useful while the window is hidden.
#[tauri::command]
async fn tray_update(app: tauri::AppHandle, apps: Vec<Value>) -> Result<()> {
    if apps.len() > APP_IDS.len() {
        return Err("Invalid tray app list".into());
    }
    let mut entries: Vec<(String, String, bool)> = Vec::new();
    for entry in &apps {
        let id = entry["id"].as_str().unwrap_or_default();
        if !APP_IDS.contains(&id) {
            return Err("Invalid tray app list".into());
        }
        if entries.iter().any(|(seen, _, _)| seen == id) {
            continue;
        }
        let name: String = entry["name"]
            .as_str()
            .unwrap_or(id)
            .chars()
            .filter(|c| !c.is_control())
            .take(48)
            .collect();
        let name = name.trim();
        entries.push((
            id.to_string(),
            if name.is_empty() { id.to_string() } else { name.to_string() },
            entry["running"] == json!(true),
        ));
    }
    let tray = app.tray_by_id("vibehub-tray").ok_or("Tray unavailable")?;
    let menu = tray_menu(&app, &entries).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
            let open = MenuItem::with_id(app, "open", "Open / باز کردن", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit / خروج", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            let mut tray = TrayIconBuilder::with_id("vibehub-tray").tooltip("VibeHub").menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => { if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.unminimize(); let _ = window.set_focus(); } },
                    "quit" => app.exit(0),
                    id if id.starts_with("rtl:") => {
                        let app_id = id.trim_start_matches("rtl:").to_string();
                        if APP_IDS.contains(&app_id.as_str()) {
                            let handle = app.clone();
                            tauri::async_runtime::spawn(async move {
                                let result = launch_app_inner(handle.clone(), json!({"appId": app_id, "rtl": true})).await;
                                if let Err(error) = result {
                                    use tauri_plugin_notification::NotificationExt;
                                    let _ = handle.notification().builder()
                                        .title("VibeHub")
                                        .body(format!("اجرای RTL ناموفق بود: {error}"))
                                        .show();
                                }
                            });
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if matches!(event, TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }) {
                        if let Some(window) = tray.app_handle().get_webview_window("main") { let _ = window.show(); let _ = window.unminimize(); let _ = window.set_focus(); }
                    }
                });
            if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
            tray.build(app)?;
            accounts::start_monitor(app.handle().clone());
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        });

    // Single-instance is release-only: a still-held dev mutex would make every
    // tauri dev restart exit immediately while the previous instance runs.
    #[cfg(not(debug_assertions))]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(debug_assertions)]
    let builder = builder;

    builder
        .invoke_handler(tauri::generate_handler![
            app_version,
            codex_accounts,
            app_path,
            detect_apps,
            detect_editors,
            rtl_components,
            focus_editor,
            rtl_setup,
            launch_editor,
            launch_app,
            launch_state,
            launch_states,
            stop_rtl,
            tray_update,
            install_winget,
            install_npm,
            proxy_list,
            proxy_save,
            proxy_delete,
            proxy_config,
            proxy_set_config,
            proxy_test,
            terminal_detect,
            claude_persian_terminal,
            terminal_install_persian,
            terminal_install_ohmyposh,
            terminal_install_font,
            terminal_apply_theme,
            terminal_undo,
            doctor_run,
            vault_set,
            vault_get,
            vault_delete,
            provider_connections,
            provider_connection_save,
            provider_connection_delete,
            provider_credentials_inventory,
            provider_credentials_clear,
            provider_connection_test,
            provider_connection_models,
            provider_connection_cached_models,
            provider_notes,
            provider_note_save,
            provider_connection_preview_test,
            provider_connection_preview_models,
            api_test,
            feed_sync
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
