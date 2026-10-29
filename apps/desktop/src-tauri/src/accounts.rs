//! Local Codex account broker. Tokens never cross the webview boundary.
//! Credential layout is pinned to codex-cli 0.148.0. Encrypted Codex auth files use
//! the official age format, with the encryption key held only in Windows Credential Manager.
use crate::{domain::Result, storage, system};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::TryRngCore;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::VecDeque,
    fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{Mutex, mpsc},
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

const SUPPORTED: &str = "0.148.0";
const DEFAULT_THRESHOLD: f64 = 1.0;
static BROKER: Mutex<Option<Broker>> = Mutex::new(None);
fn err(key: &str) -> String {
    format!("accounts:{key}")
}
fn now() -> i64 {
    chrono::Utc::now().timestamp()
}
fn fingerprint(v: &Value) -> String {
    format!("{:x}", Sha256::digest(v.to_string().as_bytes()))
}

struct Rpc {
    child: Child,
    input: ChildStdin,
    output: mpsc::Receiver<Value>,
    next: u64,
    notifications: VecDeque<Value>,
}
impl Drop for Rpc {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
impl Rpc {
    fn start(binary: &Path, home: &Path, isolated: bool, proxy: &Value) -> Result<Self> {
        fs::create_dir_all(home).map_err(|_| err("storage"))?;
        let mut command = Command::new(binary);
        command.args(["app-server", "--listen", "stdio://"]);
        if isolated {
            command.args([
                "-c",
                "cli_auth_credentials_store=\"keyring\"",
                "--enable",
                "secret_auth_storage",
            ]);
        }
        command
            .env("CODEX_HOME", home)
            .current_dir(home)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        // A shell's API key or access-token override must never select a different account.
        for key in ["OPENAI_API_KEY", "CODEX_API_KEY", "CODEX_ACCESS_TOKEN"] {
            command.env_remove(key);
        }
        if let Some(url) = proxy["proxyUrl"].as_str() {
            for key in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"] {
                command.env(key, url);
            }
            command.env("NO_PROXY", "localhost,127.0.0.1,::1");
        } else if proxy["direct"] == true {
            for key in ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY"] {
                command.env_remove(key);
            }
        }
        system::hidden(&mut command);
        Self::from_command(command)
    }
    fn from_command(mut command: Command) -> Result<Self> {
        let mut child = command.spawn().map_err(|_| err("cliMissing"))?;
        let input = child.stdin.take().ok_or_else(|| err("protocol"))?;
        let stdout = child.stdout.take().ok_or_else(|| err("protocol"))?;
        let (tx, output) = mpsc::sync_channel(128);
        std::thread::spawn(move || {
            let mut reader = BufReader::new(stdout);
            loop {
                // Bound each message before allocation, including a malicious/broken executable.
                let mut bytes = Vec::new();
                let n = reader
                    .by_ref()
                    .take(1024 * 1024 + 1)
                    .read_until(b'\n', &mut bytes);
                if !matches!(n, Ok(1..)) || bytes.len() > 1024 * 1024 {
                    break;
                }
                let Ok(value) = serde_json::from_slice(&bytes) else {
                    break;
                };
                if tx.send(value).is_err() {
                    break;
                }
            }
        });
        let mut rpc = Self {
            child,
            input,
            output,
            next: 0,
            notifications: VecDeque::new(),
        };
        rpc.call(
            "initialize",
            json!({"clientInfo":{"name":"vibehub","version":"0.1.0"},"capabilities":{}}),
        )?;
        rpc.send(json!({"method":"initialized"}))?;
        Ok(rpc)
    }
    fn send(&mut self, value: Value) -> Result<()> {
        writeln!(self.input, "{value}")
            .and_then(|_| self.input.flush())
            .map_err(|_| err("protocol"))
    }
    fn call(&mut self, method: &str, params: Value) -> Result<Value> {
        self.call_timeout(method, params, Duration::from_secs(25))
    }
    fn call_timeout(&mut self, method: &str, params: Value, timeout: Duration) -> Result<Value> {
        self.next += 1;
        let id = self.next;
        self.send(json!({"id":id,"method":method,"params":params}))?;
        let deadline = Instant::now() + timeout;
        loop {
            let value = self
                .output
                .recv_timeout(deadline.saturating_duration_since(Instant::now()))
                .map_err(|_| err("timeout"))?;
            if value["id"] == id {
                if value.get("error").is_some() {
                    return Err(err("requestFailed"));
                }
                return Ok(value["result"].clone());
            }
            if value.get("id").is_some() {
                self.send(json!({"id":value["id"],"error":{"code":-32601,"message":"Unsupported request"}}))?;
            } else if self.notifications.len() < 64 {
                self.notifications.push_back(value);
            }
        }
    }
    fn drain(&mut self) -> Vec<Value> {
        let mut values: Vec<Value> = self.notifications.drain(..).collect();
        values.extend(self.output.try_iter().take(64));
        values
    }
}

fn cli_path() -> Option<PathBuf> {
    let mut paths = Vec::new();
    for directory in std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()) {
        paths.push(directory.join("codex.exe"));
        let package = directory.join("node_modules/@openai/codex");
        for arch in ["x86_64-pc-windows-msvc", "aarch64-pc-windows-msvc"] {
            let name = if arch.starts_with("x86") {
                "codex-win32-x64"
            } else {
                "codex-win32-arm64"
            };
            paths.push(package.join(format!(
                "node_modules/@openai/{name}/vendor/{arch}/bin/codex.exe"
            )));
            paths.push(package.join(format!("vendor/{arch}/codex/codex.exe")));
        }
    }
    paths.into_iter().find(|p| p.is_file())
}
fn compatible(binary: &Path) -> bool {
    let mut cmd = Command::new(binary);
    cmd.arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    system::hidden(&mut cmd);
    let Ok(mut child) = cmd.spawn() else {
        return false;
    };
    let start = Instant::now();
    while matches!(child.try_wait(), Ok(None)) {
        if start.elapsed() > Duration::from_secs(5) {
            let _ = child.kill();
            let _ = child.wait();
            return false;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    let mut out = String::new();
    if let Some(stdout) = child.stdout.take() {
        let _ = stdout.take(256).read_to_string(&mut out);
    }
    out.trim() == format!("codex-cli {SUPPORTED}")
}
fn global_home() -> Result<PathBuf> {
    if let Some(home) = std::env::var_os("CODEX_HOME").filter(|s| !s.is_empty()) {
        return Ok(PathBuf::from(home));
    }
    std::env::var_os("USERPROFILE")
        .map(|p| PathBuf::from(p).join(".codex"))
        .ok_or_else(|| err("storage"))
}
fn keyring_entry(home: &Path) -> Result<keyring::Entry> {
    let canonical = home.canonicalize().map_err(|_| err("storage"))?;
    let digest = format!(
        "{:x}",
        Sha256::digest(canonical.to_string_lossy().as_bytes())
    );
    keyring::Entry::new("Codex Auth", &format!("cli|{}", &digest[..16])).map_err(|_| err("vault"))
}
fn read_direct_vault(home: &Path) -> Result<Option<Value>> {
    match keyring_entry(home)?.get_password() {
        Ok(secret) => serde_json::from_str(&secret)
            .map(Some)
            .map_err(|_| err("credentialInvalid")),
        Err(keyring::Error::NoEntry) => Ok(None),
        _ => Err(err("vault")),
    }
}
fn write_direct_vault(home: &Path, value: &Value) -> Result<()> {
    keyring_entry(home)?
        .set_password(&value.to_string())
        .map_err(|_| err("vault"))
}
fn delete_direct_vault(home: &Path) -> Result<()> {
    match keyring_entry(home)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        _ => Err(err("vault")),
    }
}
fn encrypted_path(home: &Path) -> PathBuf {
    home.join("secrets/codex_auth.age")
}
fn encryption_entry(home: &Path) -> Result<keyring::Entry> {
    let canonical = home.canonicalize().map_err(|_| err("storage"))?;
    let digest = format!(
        "{:x}",
        Sha256::digest(canonical.to_string_lossy().as_bytes())
    );
    keyring::Entry::new("codex", &format!("secrets|{}", &digest[..16])).map_err(|_| err("vault"))
}
fn encryption_key(home: &Path, create: bool) -> Result<age::secrecy::SecretString> {
    let entry = encryption_entry(home)?;
    match entry.get_password() {
        Ok(value) => Ok(age::secrecy::SecretString::from(value)),
        Err(keyring::Error::NoEntry) if create && !encrypted_path(home).exists() => {
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
fn read_encrypted_store(home: &Path) -> Result<Value> {
    let path = encrypted_path(home);
    if !path.exists() {
        return Ok(json!({"version":1,"secrets":{}}));
    }
    if fs::metadata(&path).map_err(|_| err("storage"))?.len() > 256 * 1024 {
        return Err(err("credentialInvalid"));
    }
    let ciphertext = fs::read(path).map_err(|_| err("storage"))?;
    let key = encryption_key(home, false)?;
    let plaintext =
        age::decrypt(&age::scrypt::Identity::new(key), &ciphertext).map_err(|_| err("vault"))?;
    let store: Value = serde_json::from_slice(&plaintext).map_err(|_| err("credentialInvalid"))?;
    if store["version"].as_u64().is_none_or(|v| v > 1) || !store["secrets"].is_object() {
        return Err(err("storageUnsupported"));
    }
    Ok(store)
}
fn read_vault(home: &Path) -> Result<Option<Value>> {
    let store = read_encrypted_store(home)?;
    store["secrets"]["global/CODEX_AUTH"]
        .as_str()
        .map(|s| serde_json::from_str(s).map_err(|_| err("credentialInvalid")))
        .transpose()
}
fn write_vault(home: &Path, value: &Value) -> Result<()> {
    let mut store = read_encrypted_store(home)?;
    store["secrets"]["global/CODEX_AUTH"] = json!(value.to_string());
    let key = encryption_key(home, true)?;
    let ciphertext = age::encrypt(
        &age::scrypt::Recipient::new(key),
        store.to_string().as_bytes(),
    )
    .map_err(|_| err("vault"))?;
    let path = encrypted_path(home);
    fs::create_dir_all(path.parent().unwrap()).map_err(|_| err("storage"))?;
    atomic_bytes(&path, &ciphertext)
}
fn delete_vault(home: &Path) -> Result<()> {
    let path = encrypted_path(home);
    if path.exists() {
        fs::remove_file(path).map_err(|_| err("storage"))?;
    }
    // This home belongs only to the selected VibeHub profile; other Codex homes are never cleared.
    match encryption_entry(home)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        _ => Err(err("vault")),
    }
}
fn config(home: &Path) -> Result<toml::Value> {
    match fs::read_to_string(home.join("config.toml")) {
        Ok(text) => toml::from_str(&text).map_err(|_| err("configuration")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Ok(toml::Value::Table(Default::default()))
        }
        _ => Err(err("configuration")),
    }
}
fn mode(home: &Path) -> Result<String> {
    let config = config(home)?;
    let mode = config
        .get("cli_auth_credentials_store")
        .and_then(toml::Value::as_str)
        .unwrap_or("file");
    if !["file", "keyring", "auto"].contains(&mode) {
        return Err(err("storageUnsupported"));
    }
    let encrypted = config
        .get("features")
        .and_then(|v| v.get("secret_auth_storage"))
        .and_then(toml::Value::as_bool)
        .unwrap_or(cfg!(windows));
    Ok(if mode == "file" {
        "file".into()
    } else {
        format!("{mode}-{}", if encrypted { "encrypted" } else { "direct" })
    })
}
fn read_global(home: &Path) -> Result<Value> {
    let mode = mode(home)?;
    if mode != "file" {
        let value = if mode.ends_with("encrypted") {
            read_vault(home)?
        } else {
            read_direct_vault(home)?
        };
        if let Some(value) = value {
            return Ok(value);
        }
        if mode.starts_with("keyring-") {
            return Ok(Value::Null);
        }
    }
    storage::read(&home.join("auth.json"), Value::Null).map_err(|_| err("credentialInvalid"))
}
fn identity(auth: &Value) -> Result<(String, String)> {
    let tokens = &auth["tokens"];
    let id = tokens["account_id"]
        .as_str()
        .ok_or_else(|| err("credentialInvalid"))?;
    let jwt = tokens["id_token"]
        .as_str()
        .ok_or_else(|| err("credentialInvalid"))?;
    for key in ["access_token", "refresh_token"] {
        if tokens[key].as_str().is_none_or(str::is_empty) {
            return Err(err("credentialInvalid"));
        }
    }
    let encoded = jwt
        .split('.')
        .nth(1)
        .ok_or_else(|| err("credentialInvalid"))?;
    let bytes = URL_SAFE_NO_PAD
        .decode(encoded.trim_end_matches('='))
        .map_err(|_| err("credentialInvalid"))?;
    let claims: Value = serde_json::from_slice(&bytes).map_err(|_| err("credentialInvalid"))?;
    let email = claims["email"].as_str().unwrap_or("Codex");
    let subject = claims["sub"]
        .as_str()
        .ok_or_else(|| err("credentialInvalid"))?;
    let key = format!("{:x}", Sha256::digest(format!("{subject}:{id}").as_bytes()));
    Ok((
        format!("account-{}", &key[..24]),
        email.chars().take(180).collect(),
    ))
}

fn parse_account_json(bytes: &[u8]) -> Result<Value> {
    if bytes.len() > 256 * 1024 {
        return Err(err("jsonInvalid"));
    }
    let auth: Value =
        serde_json::from_slice(bytes.strip_prefix(&[0xef, 0xbb, 0xbf]).unwrap_or(bytes))
            .map_err(|_| err("jsonInvalid"))?;
    identity(&auth).map_err(|_| err("jsonInvalid"))?;
    Ok(auth)
}

fn migrate_threshold(state: &mut Value) -> bool {
    if state["thresholdDefaultVersion"] == 1 {
        return false;
    }
    if state["settings"]["threshold"] == 10 {
        state["settings"]["threshold"] = json!(1);
    }
    state["thresholdDefaultVersion"] = json!(1);
    true
}

struct Login {
    id: String,
    home: PathBuf,
    rpc: Rpc,
    login_id: String,
    started: Instant,
}
struct Broker {
    path: PathBuf,
    root: PathBuf,
    global: PathBuf,
    binary: Option<PathBuf>,
    state: Value,
    login: Option<Login>,
    proxy: Value,
    desktop: Value,
}
impl Broker {
    fn lease(&self) -> Result<fs::File> {
        let file = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(self.root.join("broker.lock"))
            .map_err(|_| err("storage"))?;
        file.try_lock().map_err(|_| err("busy"))?;
        Ok(file)
    }
    fn reload(&mut self) -> Result<()> {
        let mut state = storage::read(&self.path, self.state.clone())?;
        if !state["accounts"].is_array() || !state["settings"]["enabled"].is_boolean() {
            return Err(err("storage"));
        }
        if migrate_threshold(&mut state) {
            storage::write(&self.path, &state).map_err(|_| err("storage"))?;
        }
        self.state = state;
        Ok(())
    }
    fn new(app: &tauri::AppHandle) -> Result<Self> {
        let root = app
            .path()
            .app_config_dir()
            .map_err(|_| err("storage"))?
            .join("codex-accounts");
        fs::create_dir_all(&root).map_err(|_| err("storage"))?;
        let path = root.join("accounts.json");
        let state = storage::read(
            &path,
            json!({"accounts":[],"activeId":null,"pendingId":null,"fingerprint":null,
            "settings":{"enabled":false,"threshold":1},"lastSwitch":0,"notice":null}),
        )?;
        if !state["accounts"].is_array() || !state["settings"]["enabled"].is_boolean() {
            return Err(err("storage"));
        }
        let binary = cli_path().filter(|p| compatible(p));
        Ok(Self {
            path,
            root,
            global: global_home()?,
            binary,
            state,
            login: None,
            proxy: json!({}),
            desktop: json!({}),
        })
    }
    fn save(&self) -> Result<()> {
        storage::write(&self.path, &self.state).map_err(|_| err("storage"))
    }
    fn home(&self, id: &str) -> Result<PathBuf> {
        if !crate::domain::identifier(id) || !id.starts_with("account-") {
            return Err(err("unknownAccount"));
        }
        Ok(self.root.join(id))
    }
    fn index(&self, id: &str) -> Result<usize> {
        self.state["accounts"]
            .as_array()
            .unwrap()
            .iter()
            .position(|a| a["id"] == id)
            .ok_or_else(|| err("unknownAccount"))
    }
    fn rpc(&self, home: &Path, isolated: bool) -> Result<Rpc> {
        Rpc::start(
            self.binary.as_deref().ok_or_else(|| err("cliMissing"))?,
            home,
            isolated,
            &self.proxy,
        )
    }
    fn reconcile(&mut self) -> Result<bool> {
        if !self.global.is_dir() {
            return Ok(false);
        }
        let auth = read_global(&self.global)?;
        let fp = fingerprint(&auth);
        if self.state["fingerprint"].as_str() == Some(&fp) {
            return Ok(false);
        }
        let id = identity(&auth).ok().map(|x| x.0);
        self.state["activeId"] = id
            .as_deref()
            .filter(|id| self.index(id).is_ok())
            .map_or(Value::Null, |id| json!(id));
        if let Some(id) = self.state["activeId"].as_str() {
            let home = self.home(id)?;
            fs::create_dir_all(&home).map_err(|_| err("storage"))?;
            write_vault(&home, &auth)?;
        }
        if !self.state["fingerprint"].is_null() {
            self.state["notice"] = json!("externalChanged");
        }
        self.state["fingerprint"] = json!(fp);
        self.state["pendingId"] = Value::Null;
        self.save()?;
        Ok(true)
    }
    fn add(&mut self, auth: Value, name: &str) -> Result<String> {
        let (id, email) = identity(&auth)?;
        if self.index(&id).is_err() && self.state["accounts"].as_array().unwrap().len() >= 16 {
            return Err(err("tooMany"));
        }
        let home = self.home(&id)?;
        fs::create_dir_all(&home).map_err(|_| err("storage"))?;
        write_vault(&home, &auth)?;
        if self.index(&id).is_err() {
            let name: String = if name.trim().is_empty() {
                email.clone()
            } else {
                name.trim()
                    .chars()
                    .filter(|c| !c.is_control())
                    .take(120)
                    .collect()
            };
            self.state["accounts"]
                .as_array_mut()
                .unwrap()
                .push(json!({"id":id,"name":name,
                "email":email,"plan":null,"windows":[],"checkedAt":null,"error":null}));
        } else {
            let i = self.index(&id)?;
            self.state["accounts"][i]["windows"] = json!([]);
            self.state["accounts"][i]["checkedAt"] = Value::Null;
            self.state["accounts"][i]["error"] = Value::Null;
        }
        self.save()?;
        Ok(id)
    }
    fn read_initial_account(&mut self) -> Result<()> {
        if self.state["initialAccountRead"] == true {
            return Ok(());
        }
        let auth = if self.global.is_dir() {
            read_global(&self.global)?
        } else {
            Value::Null
        };
        if !auth.is_null() {
            let id = identity(&auth)?.0;
            // Never reset an existing profile's quota when detecting the current account.
            if self.index(&id).is_err() {
                self.add(auth, "")?;
            }
        }
        self.reconcile()?;
        self.state["initialAccountRead"] = json!(true);
        self.save()
    }
    fn poll_login(&mut self) -> Result<()> {
        let result = self.login.as_mut().and_then(|login| {
            let completion = login.rpc.drain().into_iter().find(|v| {
                v["method"] == "account/login/completed" && v["params"]["loginId"] == login.login_id
            });
            completion
                .map(|v| v["params"]["success"] == true)
                .or_else(|| {
                    if login.started.elapsed() > Duration::from_secs(600) {
                        Some(false)
                    } else {
                        None
                    }
                })
        });
        if let Some(success) = result {
            let login = self.login.take().unwrap();
            drop(login.rpc);
            let result = (|| {
                let auth = if success {
                    read_vault(&login.home)?
                } else {
                    None
                };
                if let Some(auth) = auth {
                    self.add(auth, &login.id).map(|_| ())
                } else {
                    Err(err("loginFailed"))
                }
            })();
            let cleanup = delete_vault(&login.home);
            fs::remove_dir(&login.home).ok(); // Codex may leave non-secret runtime files; never recursively delete them.
            result?;
            cleanup?;
        }
        Ok(())
    }
    fn refresh(&mut self, id: &str) -> Result<()> {
        let i = self.index(id)?;
        let active = self.state["activeId"] == id;
        let home = if active {
            self.global.clone()
        } else {
            self.home(id)?
        };
        let result = (|| {
            let mut rpc = self.rpc(&home, !active)?;
            let account = rpc.call("account/read", json!({"refreshToken":false}))?;
            if account["account"]["type"] != "chatgpt" {
                return Err(err("loginRequired"));
            }
            let quotas = rpc.call("account/rateLimits/read", json!({}))?;
            let auth = if active {
                read_global(&home)?
            } else {
                read_vault(&home)?.ok_or_else(|| err("loginRequired"))?
            };
            if identity(&auth)?.0 != id {
                return Err(err("externalChanged"));
            }
            let windows = quota_windows(&quotas);
            self.state["accounts"][i]["windows"] = json!(windows);
            self.state["accounts"][i]["plan"] = account["account"]["planType"].clone();
            self.state["accounts"][i]["checkedAt"] = json!(now());
            if active {
                self.state["fingerprint"] = json!(fingerprint(&auth));
                write_vault(&self.home(id)?, &auth)?;
            }
            Ok(())
        })();
        self.state["accounts"][i]["error"] = result.as_ref().err().map_or(Value::Null, |e| {
            json!(e.strip_prefix("accounts:").unwrap_or("requestFailed"))
        });
        self.save()?;
        result
    }
    fn switch(&mut self, app: &tauri::AppHandle, id: &str, confirmed: bool) -> Result<()> {
        self.index(id)?;
        if self.reconcile()? {
            return Err(err("externalChanged"));
        }
        self.desktop = system::powershell(app, json!({"operation":"codex-desktop"}))?;
        if self.desktop["ambiguous"] == true {
            return Err(err("desktopAmbiguous"));
        }
        if self.desktop["running"] == true && !confirmed {
            self.state["pendingId"] = json!(id);
            self.state["notice"] = json!("restartRequired");
            return self.save();
        }
        let next = read_vault(&self.home(id)?)?.ok_or_else(|| err("loginRequired"))?;
        identity(&next)?;
        let before = read_global(&self.global)?;
        let cfg = config(&self.global)?;
        if cfg
            .get("forced_login_method")
            .and_then(toml::Value::as_str)
            .is_some_and(|v| v != "chatgpt")
        {
            return Err(err("configuration"));
        }
        if let Some(workspace) = cfg
            .get("forced_chatgpt_workspace_id")
            .and_then(toml::Value::as_str)
        {
            if next["tokens"]["account_id"] != workspace {
                return Err(err("configuration"));
            }
        }
        let restarted = self.desktop["running"] == true;
        if restarted {
            system::powershell(app, json!({"operation":"codex-desktop-close"}))?;
        }
        // Compare again after closing: desktop shutdown may persist a freshly rotated token.
        if fingerprint(&read_global(&self.global)?) != fingerprint(&before) {
            self.reconcile()?;
            if restarted {
                let _ = system::powershell(
                    app,
                    json!({"operation":"codex-desktop-open","path":self.desktop["launchPath"]}),
                );
            }
            return Err(err("externalChanged"));
        }
        let mut committed = self.state.clone();
        if self.state["activeId"] != id { committed["previousId"] = self.state["activeId"].clone(); }
        committed["activeId"] = json!(id);
        committed["pendingId"] = Value::Null;
        committed["lastSwitch"] = json!(now());
        committed["notice"] = json!("switched");
        let result = replace_global(&self.global, &next, &before, || {
            // Verify using Codex itself: its policy/config layers remain authoritative.
            let mut rpc = self.rpc(&self.global, false)?;
            let account = rpc.call("account/read", json!({"refreshToken":false}))?;
            if account["account"]["type"] != "chatgpt"
                || identity(&read_global(&self.global)?)?.0 != id
            {
                return Err(err("switchFailed"));
            }
            committed["fingerprint"] = json!(fingerprint(&read_global(&self.global)?));
            storage::write(&self.path, &committed).map_err(|_| err("storage"))
        });
        if let Err(error) = result {
            if restarted {
                let _ = system::powershell(
                    app,
                    json!({"operation":"codex-desktop-open","path":self.desktop["launchPath"]}),
                );
            }
            return Err(error);
        }
        self.state = committed;
        if restarted {
            system::powershell(
                app,
                json!({"operation":"codex-desktop-open","path":self.desktop["launchPath"]}),
            )
            .map_err(|_| err("restartFailed"))?;
        }
        Ok(())
    }
    fn validate_pending_automatic(&mut self, id: &str) -> Result<bool> {
        if self.state["pendingAutomatic"] != true {
            return Ok(true);
        }
        let active = self.state["activeId"].as_str().map(str::to_owned);
        if let Some(active) = active {
            let _ = self.refresh(&active);
        }
        let _ = self.refresh(id);
        let index = self.index(id)?;
        let valid = self.state["settings"]["enabled"] == true
            && depleted(&self.state, now())
            && headroom(&self.state["accounts"][index], now()).is_some_and(|n| {
                n > self.state["settings"]["threshold"]
                    .as_f64()
                    .unwrap_or(DEFAULT_THRESHOLD)
            });
        if !valid {
            self.state["pendingId"] = Value::Null;
            self.state["pendingAutomatic"] = json!(false);
            self.state["notice"] = json!("noCandidate");
            self.save()?;
        }
        Ok(valid)
    }
    fn process_pending(&mut self, app: &tauri::AppHandle) -> Result<()> {
        let Some(id) = self.state["pendingId"].as_str().map(str::to_owned) else {
            return Ok(());
        };
        let desktop = system::powershell(app, json!({"operation":"codex-desktop"}))?;
        if desktop["running"] == true {
            return Ok(());
        }
        if self.validate_pending_automatic(&id)? {
            self.switch(app, &id, false)?;
            notify(
                app,
                "switched",
                self.state["language"].as_str().unwrap_or("en"),
            );
        }
        Ok(())
    }
    fn automation(&mut self, app: &tauri::AppHandle) -> Result<()> {
        if self.state["settings"]["enabled"] != true || self.binary.is_none() {
            return Ok(());
        }
        if self.reconcile()? {
            return Ok(());
        }
        if !self.state["pendingId"].is_null() {
            return self.process_pending(app);
        }
        if now() - self.state["lastSwitch"].as_i64().unwrap_or(0) < 600 {
            return Ok(());
        }
        let ids: Vec<String> = self.state["accounts"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|a| a["id"].as_str().map(str::to_owned))
            .collect();
        for id in ids {
            let _ = self.refresh(&id);
        }
        if let Some(id) = candidate(&self.state, now()) {
            self.state["pendingAutomatic"] = json!(true);
            self.switch(app, &id, false)?;
            notify(
                app,
                if self.state["pendingId"].is_null() {
                    "switched"
                } else {
                    "restartRequired"
                },
                self.state["language"].as_str().unwrap_or("en"),
            );
        } else if depleted(&self.state, now()) && self.state["notice"] != "noCandidate" {
            self.state["notice"] = json!("noCandidate");
            self.save()?;
            notify(
                app,
                "noCandidate",
                self.state["language"].as_str().unwrap_or("en"),
            );
        }
        Ok(())
    }
    fn snapshot(&self) -> Value {
        let accounts: Vec<Value> = self.state["accounts"]
            .as_array()
            .unwrap()
            .iter()
            .map(|a| {
                json!({
            "id":a["id"],"name":a["name"],"email":a["email"],"plan":a["plan"],
            "windows":a["windows"],"checkedAt":a["checkedAt"],"error":a["error"]})
            })
            .collect();
        let mut value = json!({"accounts":accounts,"activeId":self.state["activeId"],"pendingId":self.state["pendingId"],
            "previousId":self.state["previousId"],"settings":self.state["settings"],"lastSwitch":self.state["lastSwitch"],"notice":self.state["notice"]});
        value["cliReady"] = json!(self.binary.is_some());
        value["supportedVersion"] = json!(SUPPORTED);
        value["desktopRunning"] = self.desktop["running"].clone();
        value["desktopVerified"] = json!(false); // Only a recorded live acceptance can change this claim.
        value["loginPending"] = json!(self.login.is_some());
        value
    }
}
fn replace_global(
    home: &Path,
    next: &Value,
    before: &Value,
    verify: impl FnOnce() -> Result<()>,
) -> Result<()> {
    if fingerprint(&read_global(home)?) != fingerprint(before) {
        return Err(err("externalChanged"));
    }
    let mode = mode(home)?;
    let file = home.join("auth.json");
    let old_file = match fs::read(&file) {
        Ok(bytes) => Some(bytes),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        _ => return Err(err("storage")),
    };
    let old_vault = if mode.ends_with("encrypted") {
        read_vault(home)?
    } else if mode.ends_with("direct") {
        read_direct_vault(home)?
    } else {
        None
    };
    let publish = if mode == "file" {
        atomic_bytes(&file, next.to_string().as_bytes())
    } else if mode.ends_with("encrypted") {
        write_vault(home, next)
    } else {
        write_direct_vault(home, next)
    };
    let result = publish.and_then(|_| verify());
    if let Err(error) = result {
        // Never roll back over a third party's newly selected account.
        let current = read_global(home)?;
        if !current.is_null()
            && fingerprint(&current) != fingerprint(before)
            && fingerprint(&current) != fingerprint(next)
        {
            return Err(err("externalChanged"));
        }
        let rollback: Result<()> = (|| {
            if mode == "file" {
                if let Some(bytes) = old_file {
                    atomic_bytes(&file, &bytes)?;
                } else if file.exists() {
                    fs::remove_file(&file).map_err(|_| err("storage"))?;
                }
            } else if mode.ends_with("encrypted") {
                if let Some(value) = old_vault {
                    write_vault(home, &value)?;
                } else if encrypted_path(home).exists() {
                    fs::remove_file(encrypted_path(home)).map_err(|_| err("storage"))?;
                }
            } else if let Some(value) = old_vault {
                write_direct_vault(home, &value)?;
            } else {
                delete_direct_vault(home)?;
            }
            Ok(())
        })();
        return if rollback.is_err() {
            Err(err("rollbackFailed"))
        } else {
            Err(error)
        };
    }
    Ok(())
}
fn atomic_bytes(path: &Path, bytes: &[u8]) -> Result<()> {
    let tmp = path.with_extension("vibehub.tmp");
    let result = (|| {
        let mut file = fs::File::create(&tmp).map_err(|_| err("storage"))?;
        file.write_all(bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| err("storage"))?;
        drop(file);
        fs::rename(&tmp, path).map_err(|_| err("storage"))
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}
fn notify(app: &tauri::AppHandle, reason: &str, language: &str) {
    let fa = language == "fa";
    let body = match (fa, reason) {
        (true, "restartRequired") => {
            "تعویض حساب Codex آماده است؛ برای راه‌اندازی مجدد، وایب‌هاب را باز کنید."
        }
        (true, "switched") => "حساب فعال Codex تغییر کرد.",
        (true, _) => "حساب Codex دیگری با سهمیه کافی پیدا نشد.",
        (false, "restartRequired") => {
            "Codex account switch is waiting for your restart confirmation in VibeHub."
        }
        (false, "switched") => "The active Codex account changed.",
        (false, _) => "No other Codex account has sufficient available quota.",
    };
    let _ = app
        .notification()
        .builder()
        .title("VibeHub · Codex")
        .body(body)
        .show();
    let _ = app.emit("codex-accounts-changed", json!({"reason":reason}));
}
fn quota_windows(raw: &Value) -> Vec<Value> {
    let buckets: Vec<(String, &Value)> = if let Some(map) = raw["rateLimitsByLimitId"]
        .as_object()
        .filter(|m| !m.is_empty())
    {
        map.iter().map(|(k, v)| (k.clone(), v)).collect()
    } else {
        vec![("codex".into(), &raw["rateLimits"])]
    };
    let mut result = Vec::new();
    for (bucket, limits) in buckets {
        for name in ["primary", "secondary"] {
            let window = &limits[name];
            if window.is_null() {
                continue;
            }
            let used = window["usedPercent"]
                .as_f64()
                .filter(|v| v.is_finite() && (0.0..=100.0).contains(v));
            result.push(
                json!({"bucket":bucket,"name":name,"remaining":used.map(|v|100.0-v),
            "minutes":window["windowDurationMins"],"resetsAt":window["resetsAt"]}),
            );
        }
    }
    result
}
fn headroom(account: &Value, timestamp: i64) -> Option<f64> {
    let checked = account["checkedAt"].as_i64()?;
    if !account["error"].is_null() || timestamp < checked || timestamp - checked > 360 {
        return None;
    }
    let windows = account["windows"].as_array()?;
    if windows.is_empty() {
        return None;
    }
    let mut min: f64 = 100.0;
    for window in windows {
        let remaining = window["remaining"].as_f64()?;
        if !(0.0..=100.0).contains(&remaining)
            || window["resetsAt"].as_i64().is_none_or(|t| t <= timestamp)
        {
            return None;
        }
        min = min.min(remaining);
    }
    Some(min)
}
fn depleted(state: &Value, timestamp: i64) -> bool {
    state["accounts"].as_array().is_some_and(|accounts| {
        accounts.iter().any(|a| {
            a["id"] == state["activeId"]
                && headroom(a, timestamp).is_some_and(|v| {
                    v <= state["settings"]["threshold"]
                        .as_f64()
                        .unwrap_or(DEFAULT_THRESHOLD)
                })
        })
    })
}
fn candidate(state: &Value, timestamp: i64) -> Option<String> {
    if state["settings"]["enabled"] != true
        || timestamp - state["lastSwitch"].as_i64().unwrap_or(0) < 600
        || !depleted(state, timestamp)
    {
        return None;
    }
    let threshold = state["settings"]["threshold"]
        .as_f64()
        .unwrap_or(DEFAULT_THRESHOLD);
    let mut best: Option<(&Value, f64)> = None;
    for account in state["accounts"].as_array()? {
        if account["id"] == state["activeId"] {
            continue;
        }
        if let Some(score) = headroom(account, timestamp).filter(|v| *v > threshold) {
            if best.is_none_or(|(_, old)| score > old) {
                best = Some((account, score));
            }
        }
    }
    best.and_then(|(a, _)| a["id"].as_str().map(str::to_owned))
}

pub fn handle(app: &tauri::AppHandle, action: &str, payload: Value) -> Result<Value> {
    // ponytail: one broker serializes at most 16 local accounts; split locks if parallel refresh is needed.
    let mut guard = BROKER.try_lock().map_err(|_| err("busy"))?;
    if guard.is_none() {
        *guard = Some(Broker::new(app)?);
    }
    let broker = guard.as_mut().unwrap();
    let _lease = broker.lease()?;
    broker.reload()?;
    let initial = broker.state.clone();
    if let Some(language) = payload["language"]
        .as_str()
        .filter(|v| ["fa", "en"].contains(v))
    {
        if broker.state["language"] != language {
            broker.state["language"] = json!(language);
            broker.save()?;
        }
    }
    if matches!(
        action,
        "login" | "import" | "importJson" | "refresh" | "switch"
    ) {
        broker.proxy = super::launch_request(app, "chatgpt", None)?;
    }
    if let Err(error) = broker.poll_login() {
        broker.state["notice"] = json!(error.strip_prefix("accounts:").unwrap_or("loginFailed"));
    }
    match action {
        "list" => {
            broker.binary = broker
                .binary
                .take()
                .or_else(|| cli_path().filter(|p| compatible(p)));
            broker.desktop = system::powershell(app, json!({"operation":"codex-desktop"}))?;
            if let Err(error) = broker
                .read_initial_account()
                .and_then(|_| broker.reconcile())
            {
                broker.state["notice"] =
                    json!(error.strip_prefix("accounts:").unwrap_or("storage"));
            }
        }
        "login" => {
            if broker.login.is_some() {
                return Err(err("busy"));
            }
            if broker.state["accounts"].as_array().unwrap().len() >= 16 {
                return Err(err("tooMany"));
            }
            let home = broker.root.join(format!("login-{}", now()));
            let mut rpc = broker.rpc(&home, true)?;
            let response = rpc.call("account/login/start", json!({"type":"chatgpt"}))?;
            let url = response["authUrl"]
                .as_str()
                .ok_or_else(|| err("protocol"))?
                .to_owned();
            let parsed = reqwest::Url::parse(&url).map_err(|_| err("protocol"))?;
            if parsed.scheme() != "https"
                || !matches!(parsed.host_str(), Some("auth.openai.com" | "chatgpt.com"))
            {
                return Err(err("protocol"));
            }
            use tauri_plugin_opener::OpenerExt;
            app.opener()
                .open_url(url, None::<&str>)
                .map_err(|_| err("browser"))?;
            broker.login = Some(Login {
                id: payload["name"]
                    .as_str()
                    .unwrap_or("")
                    .chars()
                    .take(120)
                    .collect(),
                home,
                rpc,
                login_id: response["loginId"]
                    .as_str()
                    .ok_or_else(|| err("protocol"))?
                    .into(),
                started: Instant::now(),
            });
        }
        "cancel" => {
            if let Some(mut login) = broker.login.take() {
                let _ = login
                    .rpc
                    .call("account/login/cancel", json!({"loginId":login.login_id}));
                drop(login.rpc);
                delete_vault(&login.home)?;
            }
        }
        "import" => {
            if broker.binary.is_none() {
                return Err(err("cliMissing"));
            }
            let auth = read_global(&broker.global)?;
            let id = broker.add(auth, payload["name"].as_str().unwrap_or(""))?;
            broker.state["fingerprint"] = Value::Null;
            broker.reconcile()?;
            let _ = broker.refresh(&id);
        }
        "importJson" => {
            // Only a native file picker chooses the file. Secrets never enter webview IPC.
            let selection = system::powershell(app, json!({"operation":"pick-account-json"}))?;
            if let Some(path) = selection["path"].as_str() {
                let mut bytes = Vec::new();
                fs::File::open(path)
                    .and_then(|file| file.take(256 * 1024 + 1).read_to_end(&mut bytes))
                    .map_err(|_| err("jsonInvalid"))?;
                let auth = parse_account_json(&bytes)?;
                broker.add(auth, payload["name"].as_str().unwrap_or(""))?;
                broker.reconcile()?;
            }
        }
        "refresh" => {
            broker.reconcile()?;
            broker.refresh(
                payload["id"]
                    .as_str()
                    .ok_or_else(|| err("unknownAccount"))?,
            )?;
        }
        "rename" => {
            let i = broker.index(payload["id"].as_str().unwrap_or(""))?;
            let name = payload["name"].as_str().unwrap_or("").trim();
            if name.is_empty() || name.chars().count() > 120 || name.chars().any(char::is_control) {
                return Err(err("invalidName"));
            }
            broker.state["accounts"][i]["name"] = json!(name);
            broker.save()?;
        }
        "delete" => {
            let id = payload["id"].as_str().unwrap_or("");
            let i = broker.index(id)?;
            delete_vault(&broker.home(id)?)?;
            broker.state["accounts"].as_array_mut().unwrap().remove(i);
            if broker.state["activeId"] == id {
                broker.state["activeId"] = Value::Null;
            }
            if broker.state["pendingId"] == id {
                broker.state["pendingId"] = Value::Null;
            }
            broker.save()?;
        }
        "switch" => {
            let id = payload["id"].as_str().unwrap_or("");
            if broker.state["pendingId"] == id && broker.state["pendingAutomatic"] == true {
                if broker.validate_pending_automatic(id)? {
                    broker.switch(app, id, payload["confirmRestart"] == true)?;
                }
            } else {
                broker.state["pendingAutomatic"] = json!(false);
                broker.switch(app, id, payload["confirmRestart"] == true)?;
            }
        }
        "dismiss" => {
            broker.state["pendingId"] = Value::Null;
            broker.state["notice"] = Value::Null;
            broker.save()?;
        }
        "settings" => {
            let threshold = payload["threshold"]
                .as_u64()
                .filter(|v| *v <= 90)
                .ok_or_else(|| err("configuration"))?;
            let enabled = payload["enabled"]
                .as_bool()
                .ok_or_else(|| err("configuration"))?;
            broker.state["settings"] = json!({"enabled":enabled,"threshold":threshold});
            broker.save()?;
            if !enabled && broker.state["pendingAutomatic"] == true {
                broker.state["pendingId"] = Value::Null;
                broker.state["pendingAutomatic"] = json!(false);
                broker.state["notice"] = Value::Null;
                broker.save()?;
            }
        }
        _ => return Err(err("protocol")),
    }
    if broker.state != initial {
        broker.save()?;
    }
    Ok(broker.snapshot())
}
pub fn start_monitor(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut next = Instant::now() + Duration::from_secs(300);
        loop {
            std::thread::sleep(Duration::from_secs(10));
            let Ok(mut guard) = BROKER.try_lock() else {
                continue;
            };
            if guard.is_none() {
                *guard = Broker::new(&app).ok();
            }
            let Some(broker) = guard.as_mut() else {
                continue;
            };
            let Ok(_lease) = broker.lease() else {
                continue;
            };
            if broker.reload().is_err() {
                continue;
            }
            let initial = broker.state.clone();
            if let Err(error) = broker.poll_login() {
                broker.state["notice"] =
                    json!(error.strip_prefix("accounts:").unwrap_or("loginFailed"));
            }
            if !broker.state["pendingId"].is_null() {
                match super::launch_request(&app, "chatgpt", None) {
                    Ok(proxy) => {
                        broker.proxy = proxy;
                        let _ = broker.process_pending(&app);
                    }
                    Err(_) => broker.state["notice"] = json!("requestFailed"),
                }
            }
            if Instant::now() >= next {
                if let Ok(proxy) = super::launch_request(&app, "chatgpt", None) {
                    broker.proxy = proxy;
                    if let Err(error) = broker.automation(&app) {
                        broker.state["notice"] =
                            json!(error.strip_prefix("accounts:").unwrap_or("requestFailed"));
                    }
                }
                next = Instant::now() + Duration::from_secs(300);
            }
            if broker.state != initial {
                let _ = broker.save();
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Sandbox(PathBuf);
    impl Sandbox {
        fn new() -> Self {
            static NEXT_SANDBOX: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!(
                "vibehub-accounts-{}-{}-{}",
                std::process::id(),
                chrono::Utc::now().timestamp_nanos_opt().unwrap(),
                NEXT_SANDBOX.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for Sandbox {
        fn drop(&mut self) {
            let _ = delete_vault(&self.0);
            let _ = delete_direct_vault(&self.0);
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    fn synthetic_auth(workspace: &str) -> Value {
        let claims = URL_SAFE_NO_PAD.encode(json!({"sub":"fixture","email":"fixture@example.invalid","https://api.openai.com/auth":{"chatgpt_account_id":workspace,"chatgpt_plan_type":"plus"}}).to_string());
        json!({"tokens":{"account_id":workspace,"id_token":format!("e30.{claims}.e30"),"access_token":"synthetic-access","refresh_token":"synthetic-refresh"},"last_refresh":"2026-10-27T00:00:00Z"})
    }
    #[test]
    fn json_import_validates_schema_size_and_never_echoes_secrets() {
        let auth = synthetic_auth("json");
        assert_eq!(
            parse_account_json(auth.to_string().as_bytes()).unwrap(),
            auth
        );
        let mut bom = vec![0xef, 0xbb, 0xbf];
        bom.extend(auth.to_string().as_bytes());
        assert_eq!(parse_account_json(&bom).unwrap(), auth);
        for bytes in [
            b"synthetic-secret".to_vec(),
            b"{}".to_vec(),
            vec![b' '; 256 * 1024 + 1],
            b"[]".to_vec(),
        ] {
            assert_eq!(parse_account_json(&bytes).unwrap_err(), err("jsonInvalid"));
        }
    }
    #[test]
    fn default_threshold_migration_runs_once_and_preserves_custom_values() {
        let mut state = json!({"settings":{"enabled":false,"threshold":10}});
        assert!(migrate_threshold(&mut state));
        assert_eq!(state["settings"]["threshold"], 1);
        assert_eq!(state["settings"]["enabled"], false);
        state["settings"]["threshold"] = json!(10);
        assert!(!migrate_threshold(&mut state));
        assert_eq!(state["settings"]["threshold"], 10);
        let mut custom = json!({"settings":{"threshold":5}});
        migrate_threshold(&mut custom);
        assert_eq!(custom["settings"]["threshold"], 5);
    }
    #[test]
    fn one_percent_threshold_does_not_switch_early_or_choose_an_exhausted_account() {
        let mut state = json!({"accounts":[account("a",1.1),account("b",1.0),account("c",60.0)],"activeId":"a","settings":{"enabled":true},"lastSwitch":0});
        assert_eq!(candidate(&state, 1000), None);
        state["accounts"][0]["windows"][0]["remaining"] = json!(1.0);
        assert_eq!(candidate(&state, 1000), Some("c".into()));
        state["accounts"][2]["windows"][0]["remaining"] = json!(0.0);
        assert_eq!(candidate(&state, 1000), None);
    }
    #[test]
    fn initial_local_account_is_saved_without_replacing_current_credentials() {
        let global = Sandbox::new();
        let profiles = Sandbox::new();
        let auth = synthetic_auth("current");
        storage::write(&global.0.join("auth.json"), &auth).unwrap();
        let mut broker = Broker {
            path: profiles.0.join("accounts.json"),
            root: profiles.0.clone(),
            global: global.0.clone(),
            binary: None,
            state: json!({"accounts":[],"settings":{"enabled":false,"threshold":1}}),
            login: None,
            proxy: json!({}),
            desktop: json!({}),
        };
        broker.read_initial_account().unwrap();
        let id = identity(&auth).unwrap().0;
        assert_eq!(broker.state["activeId"], id);
        assert_eq!(broker.state["accounts"].as_array().unwrap().len(), 1);
        assert_eq!(read_global(&global.0).unwrap(), auth);
        broker.read_initial_account().unwrap();
        assert_eq!(broker.state["accounts"].as_array().unwrap().len(), 1);
        delete_vault(&broker.home(&id).unwrap()).unwrap();
    }
    #[test]
    fn file_transaction_rolls_back_and_refuses_external_edits() {
        let root = Sandbox::new();
        let path = root.0.join("auth.json");
        let before = synthetic_auth("before");
        let next = synthetic_auth("next");
        storage::write(&path, &before).unwrap();
        assert!(replace_global(&root.0, &next, &before, || Err(err("switchFailed"))).is_err());
        assert_eq!(read_global(&root.0).unwrap(), before);
        let blocked = root.0.join("blocked-index");
        fs::write(&blocked, b"not a directory").unwrap();
        assert!(
            replace_global(&root.0, &next, &before, || {
                storage::write(&blocked.join("accounts.json"), &json!({"activeId":"next"}))
            })
            .is_err()
        );
        assert_eq!(read_global(&root.0).unwrap(), before);
        let external = synthetic_auth("external");
        storage::write(&path, &external).unwrap();
        assert_eq!(
            replace_global(&root.0, &next, &before, || Ok(())).unwrap_err(),
            err("externalChanged")
        );
        assert_eq!(read_global(&root.0).unwrap(), external);
        assert_eq!(
            replace_global(&root.0, &next, &external, || {
                storage::write(&path, &before)?;
                Err(err("switchFailed"))
            })
            .unwrap_err(),
            err("externalChanged")
        );
        assert_eq!(read_global(&root.0).unwrap(), before);
    }
    #[test]
    fn encrypted_profiles_keep_tokens_off_disk_and_restore_failed_switch() {
        let root = Sandbox::new();
        fs::write(
            root.0.join("config.toml"),
            "cli_auth_credentials_store = 'keyring'\n[features]\nsecret_auth_storage = true\n",
        )
        .unwrap();
        let before = synthetic_auth("before");
        let next = synthetic_auth("next");
        write_vault(&root.0, &before).unwrap();
        assert_eq!(read_global(&root.0).unwrap(), before);
        assert!(!root.0.join("auth.json").exists());
        let ciphertext = fs::read(encrypted_path(&root.0)).unwrap();
        assert!(!String::from_utf8_lossy(&ciphertext).contains("synthetic-access"));
        assert!(replace_global(&root.0, &next, &before, || Err(err("switchFailed"))).is_err());
        assert_eq!(read_global(&root.0).unwrap(), before);
        replace_global(&root.0, &next, &before, || Ok(())).unwrap();
        assert_eq!(read_global(&root.0).unwrap(), next);
    }
    #[test]
    fn rpc_preserves_login_notifications_and_redacts_protocol_errors() {
        let script = r#"while($line=[Console]::ReadLine()) {
            $r=$line|ConvertFrom-Json
            if($r.method -eq 'initialized'){continue}
            if($r.method -eq 'account/login/start'){
                [Console]::WriteLine('{"method":"account/login/completed","params":{"loginId":"fixture","success":false}}')
                $result=@{loginId='fixture'}
            } elseif($r.method -eq 'fail') {
                [Console]::WriteLine((@{id=$r.id;error=@{message='synthetic-secret'}}|ConvertTo-Json -Compress));continue
            } else {$result=@{}}
            [Console]::WriteLine((@{id=$r.id;result=$result}|ConvertTo-Json -Compress))
        }"#;
        let mut command = Command::new("powershell.exe");
        command
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                script,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        system::hidden(&mut command);
        let mut rpc = Rpc::from_command(command).unwrap();
        assert_eq!(
            rpc.call("account/login/start", json!({})).unwrap()["loginId"],
            "fixture"
        );
        assert!(
            rpc.drain().iter().any(
                |n| n["method"] == "account/login/completed" && n["params"]["success"] == false
            )
        );
        let error = rpc
            .call("fail", json!({"secret":"synthetic-secret"}))
            .unwrap_err();
        assert_eq!(error, err("requestFailed"));
        assert!(!error.contains("synthetic-secret"));
    }
    #[test]
    #[ignore = "Opt-in installed Codex CLI compatibility check, using isolated synthetic credentials and loopback-only endpoints"]
    fn installed_cli_reads_official_encrypted_profile() {
        let binary = cli_path().expect("Codex CLI must be installed");
        assert!(compatible(&binary));
        let root = Sandbox::new();
        fs::write(root.0.join("config.toml"),"chatgpt_base_url = 'http://127.0.0.1:9'\nopenai_base_url = 'http://127.0.0.1:9/v1'\ncheck_for_update_on_startup = false\n").unwrap();
        write_vault(&root.0, &synthetic_auth("fixture")).unwrap();
        let mut rpc = Rpc::start(&binary, &root.0, true, &json!({"direct":true})).unwrap();
        let result = rpc
            .call("account/read", json!({"refreshToken":false}))
            .unwrap();
        assert_eq!(result["account"]["type"], "chatgpt");
        assert_eq!(result["account"]["email"], "fixture@example.invalid");
    }
    fn account(id: &str, remaining: f64) -> Value {
        json!({"id":id,"error":null,"checkedAt":1000,"windows":[{"remaining":remaining,"resetsAt":2000}]})
    }
    #[test]
    fn automation_uses_fresh_known_windows_and_cooldown() {
        let mut state = json!({"accounts":[account("a",9.0),account("b",60.0),account("c",80.0)],"activeId":"a","settings":{"enabled":true,"threshold":10},"lastSwitch":0});
        assert_eq!(candidate(&state, 1001).as_deref(), Some("c"));
        state["accounts"][2]["error"] = json!("loginRequired");
        assert_eq!(candidate(&state, 1001).as_deref(), Some("b"));
        state["lastSwitch"] = json!(900);
        assert_eq!(candidate(&state, 1001), None);
        state["lastSwitch"] = json!(0);
        assert_eq!(candidate(&state, 1400), None);
        state["settings"]["enabled"] = json!(false);
        assert_eq!(candidate(&state, 1001), None);
    }
    #[test]
    fn missing_invalid_or_reset_quota_is_never_eligible() {
        let mut a = account("a", 20.0);
        a["windows"][0]["remaining"] = Value::Null;
        assert_eq!(headroom(&a, 1001), None);
        a["windows"][0]["remaining"] = json!(101);
        assert_eq!(headroom(&a, 1001), None);
        a["windows"][0]["remaining"] = json!(80);
        a["windows"][0]["resetsAt"] = json!(1000);
        assert_eq!(headroom(&a, 1001), None);
        assert!(quota_windows(&json!({"rateLimits":null})).is_empty());
        let windows = quota_windows(&json!({"rateLimits":{"primary":{"usedPercent":110}}}));
        assert!(windows[0]["remaining"].is_null());
    }
    #[test]
    fn identity_requires_oauth_and_separates_workspaces() {
        assert!(identity(&json!({"OPENAI_API_KEY":"synthetic"})).is_err());
        let claims = URL_SAFE_NO_PAD.encode(br#"{"sub":"test","email":"test@example.invalid"}"#);
        let mut auth = json!({"tokens":{"account_id":"one","id_token":format!("x.{claims}.x"),"access_token":"synthetic","refresh_token":"synthetic"}});
        let first = identity(&auth).unwrap();
        auth["tokens"]["account_id"] = json!("two");
        assert_ne!(first.0, identity(&auth).unwrap().0);
    }
    #[test]
    fn webview_projection_excludes_credentials_and_auth_fingerprint() {
        let root = Sandbox::new();
        let broker = Broker {
            path: root.0.join("accounts.json"),
            root: root.0.clone(),
            global: root.0.clone(),
            binary: None,
            state: json!({"accounts":[{"id":"account-test","name":"Test","email":"test@example.invalid","tokens":{"access_token":"synthetic-secret"},"windows":[]}],"settings":{"enabled":false,"threshold":10},"fingerprint":"synthetic-fingerprint","tokens":"synthetic-secret"}),
            login: None,
            proxy: json!({}),
            desktop: json!({"running":false}),
        };
        let projection = broker.snapshot().to_string();
        assert!(!projection.contains("synthetic-secret"));
        assert!(!projection.contains("synthetic-fingerprint"));
        assert!(!projection.contains("tokens"));
    }
}
