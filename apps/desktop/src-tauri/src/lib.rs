mod accounts;
mod app_accounts;
mod domain;
mod network;
mod storage;
mod system;

use domain::{APP_IDS, EDITOR_IDS, Result};
use serde_json::{Value, json};
use tauri::Manager;

#[tauri::command]
async fn app_accounts(app: tauri::AppHandle, app_id: String, action: String, payload: Value) -> Result<Value> {
    system::blocking(move || app_accounts::handle(&app, &app_id, &action, payload)).await
}

#[tauri::command]
async fn codex_accounts(app: tauri::AppHandle, action: String, payload: Value) -> Result<Value> {
    system::blocking(move || accounts::handle(&app, &action, payload)).await
}

#[tauri::command]
async fn app_path(app: tauri::AppHandle, app_id: String, path: String) -> Result<()> {
    if !["qoder", "zcode", "deepseek-harness", "antigravity"].contains(&app_id.as_str()) { return Err("Unsupported app path".into()); }
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
    system::blocking(move || {
    let root = system::resource_root(&app)?;
    let runtime_ready = system::rtl_runtime_available(&root);
    let components = [
        ("zcode", "ZCode"),
        ("qoder", "Qoder"),
        ("deepseek-harness", "DeepSeekHarness"),
        ("antigravity", "Antigravity"),
    ]
    .into_iter()
    .map(|(id, folder)| {
        let adapter = root.join("apps").join(folder);
        json!({
            "id": id,
            "available": runtime_ready
                && root.join("apps/rtl-paths.ps1").is_file()
                && adapter.join("start.ps1").is_file()
                && adapter.join("injector.mjs").is_file()
                && (!matches!(folder, "Qoder" | "Antigravity") || adapter.join("style.mjs").is_file())
        })
    })
    .collect::<Vec<_>>();
    Ok(json!(components))

    }).await
}

#[tauri::command]
async fn launch_editor(
    app: tauri::AppHandle,
    editor_id: String,
    rtl: Option<bool>,
) -> Result<Value> {
    if !EDITOR_IDS.contains(&editor_id.as_str())
        || (rtl == Some(true) && editor_id != "antigravity")
    {
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
        storage::save_provider_connection(
            &storage::provider_connection_file(&app)?,
            connection,
            key.as_deref(),
        )
    })
    .await
}

#[tauri::command]
async fn provider_connection_delete(app: tauri::AppHandle, id: String) -> Result<Value> {
    system::blocking(move || {
        let _lock = storage::SETTINGS_LOCK
            .lock()
            .map_err(|_| "Settings lock failed")?;
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
        storage::provider_credentials_clear(
            &storage::provider_connection_file(&app)?,
            &connection_ids,
            &legacy_provider_ids,
        )
    })
    .await
}

#[tauri::command]
async fn provider_connection_models(app: tauri::AppHandle, id: String) -> Result<Value> {
    let (connection, profile) = tauri::async_runtime::spawn_blocking(move || {
        let connections = storage::provider_connections(&storage::provider_connection_file(&app)?)?;
        let connection = connections.as_array().and_then(|list| list.iter().find(|item| item["id"] == id)).cloned().ok_or("Provider connection does not exist")?;
        let (profile, _) = storage::selected_profile(&storage::settings(&app)?, "*", None)?;
        Ok::<_, String>((connection, profile))
    }).await.map_err(|_| "Provider connection lookup failed")??;
    network::connection_models(connection, profile).await
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
        if id == "chatgpt" { return Err("This application does not support project folders".into()); }
    }
    if req["focus"].as_bool() == Some(true) {
        return system::blocking(move || system::powershell(&app, json!({"operation":"focus-app", "appId":id}))).await;
    }
    system::blocking(move || {
        storage::run_launch(&launch_file(&app)?, &id, || {
            let mut request = launch_request(&app, &id, req["proxyProfileId"].as_str())?;
            request["operation"] = json!("launch");
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
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

    #[cfg(not(debug_assertions))]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(debug_assertions)]
    let builder = builder;

    builder
        .invoke_handler(tauri::generate_handler![
            app_version,
            codex_accounts,
            app_accounts,
            app_path,
            detect_apps,
            detect_editors,
            rtl_components,
            launch_editor,
            launch_app,
            launch_state,
            launch_states,
            stop_rtl,
            install_winget,
            install_npm,
            proxy_list,
            proxy_save,
            proxy_delete,
            proxy_config,
            proxy_set_config,
            proxy_test,
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
            api_test,
            feed_sync
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
