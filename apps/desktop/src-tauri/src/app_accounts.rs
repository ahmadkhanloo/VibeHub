//! Version-pinned local desktop account adapters. No credential enters a webview response.
use crate::{domain::Result, network, storage, system};
use base64::{
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
    Engine,
};
use ring::{
    aead,
    rand::{SecureRandom, SystemRandom},
};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::Manager;

static QODER_OPERATION: Mutex<()> = Mutex::new(());
static ZCODE_OPERATION: Mutex<()> = Mutex::new(());
fn operation(id: &str) -> Result<std::sync::MutexGuard<'static, ()>> {
    let mutex = match id {
        "qoder" => &QODER_OPERATION,
        "zcode" => &ZCODE_OPERATION,
        _ => return Err(error("unsupportedApp")),
    };
    mutex.try_lock().map_err(|_| error("busy"))
}
fn error(key: &str) -> String {
    format!("accounts:{key}")
}
fn now() -> i64 {
    chrono::Utc::now().timestamp()
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn profile(id: &str) -> Result<PathBuf> {
    match id {
        "qoder" => Ok(
            PathBuf::from(std::env::var_os("APPDATA").ok_or(error("storage"))?)
                .join("com.qoder.app.stable"),
        ),
        "zcode" => Ok(
            PathBuf::from(std::env::var_os("USERPROFILE").ok_or(error("storage"))?)
                .join(".zcode/v2"),
        ),
        _ => Err(error("unsupportedApp")),
    }
}
fn read_bytes(path: &Path) -> Result<Vec<u8>> {
    let size = fs::metadata(path)
        .map_err(|_| error("loginRequired"))?
        .len();
    if size > 128 * 1024 {
        return Err(error("credentialInvalid"));
    }
    fs::read(path).map_err(|_| error("storage"))
}
fn read_json(path: &Path) -> Result<Value> {
    serde_json::from_slice(&read_bytes(path)?).map_err(|_| error("credentialInvalid"))
}

/// Windows DPAPI is also the vault: encrypted profile snapshots are tied to the current OS user.
fn dpapi(bytes: &[u8], protect: bool) -> Result<Vec<u8>> {
    use std::io::Read;
    if !cfg!(windows) {
        return Err(error("unsupportedApp"));
    }
    let method = if protect { "Protect" } else { "Unprotect" };
    let script = format!("$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::{method}($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))");
    let mut command = Command::new("powershell.exe");
    command
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    system::hidden(&mut command);
    let mut child = command.spawn().map_err(|_| error("vault"))?;
    let mut input = child.stdin.take().ok_or(error("vault"))?;
    let output = child.stdout.take().ok_or(error("vault"))?;
    let encoded = STANDARD.encode(bytes);
    let (input_tx, input_rx) = std::sync::mpsc::channel();
    let (output_tx, output_rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = input.write_all(encoded.as_bytes());
        drop(input);
        let _ = input_tx.send(result);
    });
    // Drain concurrently: waiting for process exit first deadlocks once encrypted output
    // fills the Windows anonymous pipe. Both channels remain bounded by the operation timeout.
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let result = output
            .take(512 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map(|_| bytes);
        let _ = output_tx.send(result);
    });
    let started = Instant::now();
    while child.try_wait().map_err(|_| error("vault"))?.is_none() {
        if started.elapsed() > Duration::from_secs(10) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error("timeout"));
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    let status = child.wait().map_err(|_| error("vault"))?;
    if !status.success() {
        return Err(error("vault"));
    }
    input_rx
        .recv_timeout(Duration::from_secs(1))
        .map_err(|_| error("timeout"))?
        .map_err(|_| error("vault"))?;
    let output = output_rx
        .recv_timeout(Duration::from_secs(1))
        .map_err(|_| error("timeout"))?
        .map_err(|_| error("vault"))?;
    if output.len() > 512 * 1024 {
        return Err(error("vault"));
    }
    STANDARD
        .decode(String::from_utf8_lossy(&output).trim())
        .map_err(|_| error("vault"))
}
fn gcm_key(key: &[u8]) -> Result<aead::LessSafeKey> {
    Ok(aead::LessSafeKey::new(
        aead::UnboundKey::new(&aead::AES_256_GCM, key).map_err(|_| error("credentialInvalid"))?,
    ))
}
fn decrypt(key: &[u8], nonce: &[u8], ciphertext: &[u8]) -> Result<Vec<u8>> {
    let nonce: [u8; 12] = nonce.try_into().map_err(|_| error("credentialInvalid"))?;
    let mut bytes = ciphertext.to_vec();
    Ok(gcm_key(key)?
        .open_in_place(
            aead::Nonce::assume_unique_for_key(nonce),
            aead::Aad::empty(),
            &mut bytes,
        )
        .map_err(|_| error("credentialInvalid"))?
        .to_vec())
}
fn encrypt(key: &[u8], plaintext: &[u8]) -> Result<([u8; 12], Vec<u8>)> {
    let mut nonce = [0; 12];
    SystemRandom::new()
        .fill(&mut nonce)
        .map_err(|_| error("vault"))?;
    let mut bytes = plaintext.to_vec();
    gcm_key(key)?
        .seal_in_place_append_tag(
            aead::Nonce::assume_unique_for_key(nonce),
            aead::Aad::empty(),
            &mut bytes,
        )
        .map_err(|_| error("vault"))?;
    Ok((nonce, bytes))
}
fn qoder_key(root: &Path) -> Result<Vec<u8>> {
    let state = read_json(&root.join("Local State"))?;
    let wrapped = STANDARD
        .decode(
            state["os_crypt"]["encrypted_key"]
                .as_str()
                .ok_or(error("credentialInvalid"))?,
        )
        .map_err(|_| error("credentialInvalid"))?;
    if !wrapped.starts_with(b"DPAPI") {
        return Err(error("unsupportedVersion"));
    }
    dpapi(&wrapped[5..], false)
}
fn zcode_key() -> Result<Vec<u8>> {
    let secret = std::env::var("ZCODE_CREDENTIAL_SECRET").unwrap_or_else(|_| {
        format!(
            "zcode-credential-fallback:win32:{}:{}",
            std::env::var("USERPROFILE").unwrap_or_default(),
            std::env::var("USERNAME").unwrap_or_default()
        )
    });
    Ok(Sha256::digest(secret.as_bytes()).to_vec())
}
fn zcode_decode(value: &str, key: &[u8]) -> Result<String> {
    let Some(body) = value.strip_prefix("enc:v1:") else {
        return Ok(value.into());
    };
    let parts: Vec<_> = body.split('.').collect();
    if parts.len() != 3 {
        return Err(error("credentialInvalid"));
    }
    let decode = |s: &str| {
        URL_SAFE_NO_PAD
            .decode(s)
            .map_err(|_| error("credentialInvalid"))
    };
    let mut ciphertext = decode(parts[2])?;
    ciphertext.extend(decode(parts[1])?);
    String::from_utf8(decrypt(key, &decode(parts[0])?, &ciphertext)?)
        .map_err(|_| error("credentialInvalid"))
}
fn auth_key(key: &str) -> bool {
    matches!(
        key,
        "oauth:active_provider"
            | "oauth:zai:access_token"
            | "oauth:zai:refresh_token"
            | "oauth:zai:user_info"
            | "zcodejwttoken"
    )
}
fn read_current(id: &str, root: &Path) -> Result<Value> {
    if id == "qoder" {
        let bytes = read_bytes(&root.join("auth.v1.dat"))?;
        if bytes.len() < 31 || &bytes[..3] != b"v10" {
            return Err(error("unsupportedVersion"));
        }
        let auth: Value =
            serde_json::from_slice(&decrypt(&qoder_key(root)?, &bytes[3..15], &bytes[15..])?)
                .map_err(|_| error("credentialInvalid"))?;
        if auth["schemaVersion"] != 1
            || auth["token"].as_str().is_none()
            || auth["refreshToken"].as_str().is_none()
            || auth["expiresAt"].as_str().is_none()
        {
            return Err(error("unsupportedVersion"));
        }
        Ok(auth)
    } else {
        let mut raw = read_json(&root.join("credentials.json"))?;
        let key = zcode_key()?;
        let map = raw.as_object_mut().ok_or(error("credentialInvalid"))?;
        map.retain(|k, _| auth_key(k));
        for value in map.values_mut() {
            *value = json!(zcode_decode(
                value.as_str().ok_or(error("credentialInvalid"))?,
                &key
            )?);
        }
        Ok(raw)
    }
}
fn local_identity(id: &str, auth: &Value) -> Result<(String, String, String)> {
    if id == "zcode" && auth["oauth:active_provider"] != "zai" {
        return Err(error("unsupportedProvider"));
    }
    let user = if id == "qoder" {
        auth["user"].clone()
    } else {
        serde_json::from_str(
            auth["oauth:zai:user_info"]
                .as_str()
                .ok_or(error("loginRequired"))?,
        )
        .map_err(|_| error("credentialInvalid"))?
    };
    let raw_id = user["id"]
        .as_str()
        .or_else(|| user["user_id"].as_str())
        .ok_or(error("credentialInvalid"))?;
    let account_id = format!("account-{}", &digest(raw_id.as_bytes())[..24]);
    Ok((
        account_id,
        user["email"].as_str().unwrap_or("").into(),
        user["name"].as_str().unwrap_or("Account").into(),
    ))
}
fn token<'a>(id: &str, auth: &'a Value) -> Result<&'a str> {
    auth[if id == "qoder" {
        "token"
    } else {
        "zcodejwttoken"
    }]
    .as_str()
    .filter(|s| !s.is_empty())
    .ok_or(error("loginRequired"))
}
fn finite(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str()?.parse().ok())
        .filter(|n| n.is_finite() && *n >= 0.0)
}
fn timestamp(value: &Value) -> Option<i64> {
    if let Some(text) = value.as_str() {
        if let Ok(time) = chrono::DateTime::parse_from_rfc3339(text) {
            return Some(time.timestamp());
        }
    }
    finite(value).map(|n| {
        if n > 1_000_000_000_000.0 {
            (n / 1000.0) as i64
        } else {
            n as i64
        }
    })
}
fn zcode_balances(envelope: &Value) -> Result<Vec<Value>> {
    if !matches!(envelope["code"].as_i64(), Some(0 | 200)) {
        return Err(error("protocol"));
    }
    let clock = timestamp(&envelope["data"]["server_time"]).unwrap_or_else(now);
    let balances = envelope["data"]["balances"]
        .as_array()
        .ok_or(error("protocol"))?;
    let mut usage = vec![];
    for balance in balances {
        if timestamp(&balance["expires_at"]).is_some_and(|end| end <= clock) {
            continue;
        }
        let Some(remaining) = finite(&balance["remaining_units"]) else {
            continue;
        };
        let total = finite(&balance["total_units"]);
        if total.is_some_and(|total| remaining > total) {
            continue;
        }
        if let Some(plans) = envelope["data"]["plans"].as_array() {
            let matched = plans
                .iter()
                .filter(|plan| {
                    balance["user_plan_id"].as_str().is_some()
                        && plan["user_plan_id"] == balance["user_plan_id"]
                })
                .collect::<Vec<_>>();
            if !matched.is_empty()
                && !matched.iter().any(|plan| {
                    plan["status"] == "active"
                        && timestamp(&plan["ends_at"]).is_none_or(|end| end > clock)
                })
            {
                continue;
            }
        }
        usage.push(json!({"label":balance["show_name"].as_str().unwrap_or("ZCode"),"remaining":remaining,"granted":total,"used":finite(&balance["used_units"]),"unit":balance["unit_type"].as_str().unwrap_or("units"),"resetsAt":balance["period_end"],"expiresAt":balance["expires_at"]}));
    }
    Ok(usage)
}

fn qoder_renewed(auth: &Value, response: &Value, clock: i64) -> Result<Value> {
    let text = |key: &str| {
        response[key]
            .as_str()
            .filter(|value| !value.trim().is_empty())
    };
    let access = text("device_token")
        .or_else(|| text("token"))
        .ok_or(error("protocol"))?;
    let refresh = text("refresh_token").ok_or(error("protocol"))?;
    let expiry = timestamp(&response["expires_at"])
        .or_else(|| {
            finite(&response["expires_in"])
                .map(|seconds| clock.saturating_add(seconds.min(315_360_000.0) as i64))
        })
        .filter(|end| *end > clock)
        .ok_or(error("protocol"))?;
    let mut next = auth.clone();
    next["token"] = json!(access);
    next["refreshToken"] = json!(refresh);
    next["expiresAt"] = json!(chrono::DateTime::from_timestamp(expiry, 0)
        .ok_or(error("protocol"))?
        .to_rfc3339());
    if let Some(expiry) = timestamp(&response["refresh_token_expires_at"]).or_else(|| {
        finite(&response["refresh_token_expires_in"])
            .map(|seconds| clock.saturating_add(seconds.min(315_360_000.0) as i64))
    }) {
        if expiry <= clock {
            return Err(error("loginRequired"));
        }
        next["refreshTokenExpiresAt"] = json!(chrono::DateTime::from_timestamp(expiry, 0)
            .ok_or(error("protocol"))?
            .to_rfc3339());
    }
    Ok(next)
}
async fn renew_qoder(client: &reqwest::Client, auth: &Value) -> Result<Value> {
    renew_qoder_at(
        client,
        auth,
        "https://openapi.qoder.sh/api/v1/deviceToken/refresh",
    )
    .await
}
async fn renew_qoder_at(client: &reqwest::Client, auth: &Value, url: &str) -> Result<Value> {
    let refresh = auth["refreshToken"]
        .as_str()
        .filter(|value| !value.is_empty())
        .ok_or(error("loginRequired"))?;
    if timestamp(&auth["refreshTokenExpiresAt"]).is_some_and(|end| end <= now()) {
        return Err(error("loginRequired"));
    }
    let response = client
        .post(url)
        .header("Accept", "application/json")
        .json(&json!({"refresh_token":refresh}))
        .send()
        .await
        .map_err(|_| error("network"))?;
    if matches!(response.status().as_u16(), 400 | 401 | 403) {
        return Err(error("loginRequired"));
    }
    if !response.status().is_success() {
        return Err(error("requestFailed"));
    }
    let body: Value = serde_json::from_slice(
        &network::bounded_bytes(response, 128 * 1024)
            .await
            .map_err(|_| error("protocol"))?,
    )
    .map_err(|_| error("protocol"))?;
    qoder_renewed(auth, &body, now())
}
async fn get(client: &reqwest::Client, url: &str, token: &str) -> Result<Value> {
    let response = client
        .get(url)
        .bearer_auth(token)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|_| error("network"))?;
    if matches!(response.status().as_u16(), 401 | 403) {
        return Err(error("loginRequired"));
    }
    if !response.status().is_success() {
        return Err(error("requestFailed"));
    }
    let bytes = network::bounded_bytes(response, 512 * 1024)
        .await
        .map_err(|_| error("protocol"))?;
    serde_json::from_slice(&bytes).map_err(|_| error("protocol"))
}
async fn inspect(id: &str, auth: &Value, client: &reqwest::Client) -> Result<Value> {
    let (account_id, email, name) = local_identity(id, auth)?;
    let credential = token(id, auth)?;
    let (plan, usage, quota_error, expires_at) = if id == "qoder" {
        let user = get(
            client,
            "https://openapi.qoder.sh/api/v1/userinfo",
            credential,
        )
        .await?;
        if user["id"] != auth["user"]["id"] {
            return Err(error("identityMismatch"));
        }
        let quota = get(
            client,
            "https://openapi.qoder.sh/api/v2/quota/usage?outerProviders=cmcc",
            credential,
        )
        .await?;
        let mut usage = vec![];
        if let Some(percent) = quota["totalUsagePercentage"].as_f64() {
            usage.push(json!({"label":"Credits", "remaining":(100.0-percent).clamp(0.0,100.0),"unit":"percent","resetsAt":quota["expiresAt"]}));
        }
        (
            quota["userType"].as_str().unwrap_or("Qoder").to_owned(),
            usage,
            None,
            timestamp(&auth["expiresAt"]),
        )
    } else {
        verify_zcode_identity(auth)?;
        // Billing current is authenticated by the app's own JWT and returns granted entitlements.
        let data = get(
            client,
            "https://zcode.z.ai/api/v1/zcode-plan/billing/current",
            credential,
        )
        .await?;
        if data["code"]
            .as_i64()
            .is_some_and(|code| code != 0 && code != 200)
        {
            return Err(error("requestFailed"));
        }
        let plans = data["data"]["plans"].as_array().ok_or(error("protocol"))?;
        let clock = timestamp(&data["data"]["server_time"]).unwrap_or_else(now);
        let plans: Vec<_> = plans
            .iter()
            .filter(|p| {
                p["status"] == "active" && timestamp(&p["ends_at"]).is_none_or(|end| end > clock)
            })
            .collect();
        let names = plans
            .iter()
            .filter_map(|p| p["name"].as_str())
            .collect::<Vec<_>>()
            .join(", ");
        let expires_at = plans.iter().filter_map(|p| timestamp(&p["ends_at"])).min();
        let mut usage = vec![];
        for plan in plans {
            if let Some(entries) = plan["entitlements"].as_array() {
                for entry in entries {
                    usage.push(json!({"label":entry["show_name"],"granted":entry["grant_units"],"remaining":null,"unit":entry["unit_type"],"resetsAt":plan["ends_at"]}));
                }
            }
        }
        let balance = get(
            client,
            "https://zcode.z.ai/api/v1/zcode-plan/billing/balance?app_version=3.16.3",
            credential,
        )
        .await
        .and_then(|body| zcode_balances(&body));
        match balance {
            Ok(balance) => (names, balance, None, expires_at),
            Err(_) => (names, usage, Some(error("balanceUnavailable")), expires_at),
        }
    };
    Ok(
        json!({"id":account_id,"name":name,"email":email,"plan":plan,"usage":usage,"checkedAt":now(),"error":null,"quotaError":quota_error,"expiresAt":expires_at}),
    )
}
fn atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let temp = path.with_extension("vibehub.tmp");
    let mut file = fs::File::create(&temp).map_err(|_| error("storage"))?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| error("storage"))?;
    fs::rename(&temp, path).map_err(|_| error("storage"))
}

/// Use each installed app's lock protocol. Never remove another writer's lock.
struct CredentialLock {
    path: PathBuf,
    owner: Option<PathBuf>,
    file: Option<fs::File>,
}
impl CredentialLock {
    fn acquire(id: &str, root: &Path) -> Result<Self> {
        let path = root.join(if id == "qoder" {
            "auth.v1.lock"
        } else {
            "credentials.json.lock"
        });
        if id == "qoder" {
            let mut options = fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(windows)]
            {
                use std::os::windows::fs::OpenOptionsExt;
                // Deny deletion while held; delete atomically when the handle closes.
                // This also prevents Qoder's five-second stale-lock recovery from
                // stealing a lease during a slow Windows credential-store operation.
                const GENERIC_WRITE_AND_DELETE: u32 = 0x4000_0000 | 0x0001_0000;
                const FILE_FLAG_DELETE_ON_CLOSE: u32 = 0x0400_0000;
                options
                    .share_mode(0)
                    .access_mode(GENERIC_WRITE_AND_DELETE)
                    .custom_flags(FILE_FLAG_DELETE_ON_CLOSE);
            }
            let file = options.open(&path).map_err(|_| error("busy"))?;
            Ok(Self {
                path,
                owner: None,
                file: Some(file),
            })
        } else {
            fs::create_dir(&path).map_err(|_| error("busy"))?;
            let nonce = format!(
                "{}-{}",
                std::process::id(),
                chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
            );
            let owner = path.join(format!("owner-{nonce}.json"));
            let value = json!({"pid":std::process::id(),"createdAt":chrono::Utc::now().timestamp_millis(),"token":nonce});
            if fs::write(&owner, value.to_string()).is_err() {
                let _ = fs::remove_dir(&path);
                return Err(error("storage"));
            }
            Ok(Self {
                path,
                owner: Some(owner),
                file: None,
            })
        }
    }
}
impl Drop for CredentialLock {
    fn drop(&mut self) {
        if let Some(owner) = &self.owner {
            let _ = fs::remove_file(owner);
            let _ = fs::remove_dir(&self.path);
        } else {
            drop(self.file.take());
            #[cfg(not(windows))]
            let _ = fs::remove_file(&self.path);
        }
    }
}

fn replace_auth(id: &str, root: &Path, expected: &Value, next: &Value) -> Result<()> {
    let _lock = CredentialLock::acquire(id, root)?;
    if read_current(id, root)? != *expected {
        return Err(error("externalChanged"));
    }
    write_current(id, root, next)
}
fn restore_auth(id: &str, root: &Path, attempted: &Value, before: &Value) -> Result<()> {
    let _lock = CredentialLock::acquire(id, root)?;
    let current = read_current(id, root)?;
    if current == *before {
        return Ok(());
    }
    if current != *attempted {
        return Err(error("externalChanged"));
    }
    write_current(id, root, before)
}
fn write_current(id: &str, root: &Path, auth: &Value) -> Result<()> {
    if id == "qoder" {
        let (nonce, ciphertext) = encrypt(
            &qoder_key(root)?,
            &serde_json::to_vec(auth).map_err(|_| error("protocol"))?,
        )?;
        let mut bytes = b"v10".to_vec();
        bytes.extend(nonce);
        bytes.extend(ciphertext);
        atomic(&root.join("auth.v1.dat"), &bytes)
    } else {
        let path = root.join("credentials.json");
        let mut raw = read_json(&path)?;
        let map = raw.as_object_mut().ok_or(error("credentialInvalid"))?;
        map.retain(|key, _| !auth_key(key));
        let key = zcode_key()?;
        for (name, value) in auth.as_object().ok_or(error("credentialInvalid"))? {
            if !auth_key(name) {
                return Err(error("credentialInvalid"));
            }
            let (nonce, bytes) = encrypt(
                &key,
                value.as_str().ok_or(error("credentialInvalid"))?.as_bytes(),
            )?;
            let split = bytes.len() - 16;
            map.insert(
                name.clone(),
                json!(format!(
                    "enc:v1:{}.{}.{}",
                    URL_SAFE_NO_PAD.encode(nonce),
                    URL_SAFE_NO_PAD.encode(&bytes[split..]),
                    URL_SAFE_NO_PAD.encode(&bytes[..split])
                )),
            );
        }
        atomic(
            &path,
            &serde_json::to_vec_pretty(&raw).map_err(|_| error("storage"))?,
        )
    }
}
fn supported(id: &str, version: &str) -> bool {
    version.trim_start_matches('v').split('+').next()
        == Some(if id == "qoder" { "0.4.2" } else { "3.16.3" })
}

fn verify_zcode_identity(auth: &Value) -> Result<()> {
    if auth["oauth:active_provider"] != "zai" {
        return Err(error("unsupportedProvider"));
    }
    let user: Value = serde_json::from_str(
        auth["oauth:zai:user_info"]
            .as_str()
            .ok_or(error("loginRequired"))?,
    )
    .map_err(|_| error("credentialInvalid"))?;
    let payload = token("zcode", auth)?
        .split('.')
        .nth(1)
        .ok_or(error("credentialInvalid"))?;
    let claims: Value = serde_json::from_slice(
        &URL_SAFE_NO_PAD
            .decode(payload)
            .map_err(|_| error("credentialInvalid"))?,
    )
    .map_err(|_| error("credentialInvalid"))?;
    // The server authenticates the signature. Bind the locally displayed identity to that token.
    if user["user_id"].as_str().is_none()
        || claims["user_id"] != user["user_id"]
        || claims["sub"] != user["user_id"]
    {
        return Err(error("identityMismatch"));
    }
    Ok(())
}

// Enable only after a recorded real two-account round trip on the exact adapter version.
// Read-only identity/quota verification alone cannot certify credential replacement.
fn switch_verified(_id: &str, _version: &str) -> bool {
    false
}

fn upsert_account(state: &mut Value, mut account: Value) -> Result<()> {
    let account_id = account["id"].as_str().ok_or(error("protocol"))?.to_owned();
    let list = state["accounts"].as_array_mut().ok_or(error("storage"))?;
    if let Some(existing) = list.iter_mut().find(|a| a["id"] == account_id) {
        account["name"] = existing["name"].clone();
        *existing = account;
    } else {
        if list.len() >= 16 {
            return Err(error("tooMany"));
        }
        list.push(account);
    }
    Ok(())
}

fn replace_and_verify<T>(
    write: impl FnOnce() -> Result<()>,
    verify: impl FnOnce() -> Result<T>,
    rollback: impl FnOnce() -> Result<()>,
) -> Result<T> {
    // A refused compare-and-swap has not written anything and must not trigger recovery.
    if let Err(reason) = write() {
        if reason == error("externalChanged") || reason == error("busy") {
            return Err(reason);
        }
        rollback().map_err(|_| error("rollbackFailed"))?;
        return Err(reason);
    }
    match verify() {
        Ok(value) => Ok(value),
        Err(reason) => {
            rollback().map_err(|_| error("rollbackFailed"))?;
            Err(reason)
        }
    }
}

pub fn handle(app: &tauri::AppHandle, id: &str, action: &str, payload: Value) -> Result<Value> {
    if id == "chatgpt" {
        return crate::accounts::handle(app, action, payload);
    }
    let _guard = operation(id)?;
    let root = profile(id)?;
    let store = app
        .path()
        .app_config_dir()
        .map_err(|_| error("storage"))?
        .join("app-accounts")
        .join(id);
    fs::create_dir_all(&store).map_err(|_| error("storage"))?;
    let state_path = store.join("profiles.json");
    let mut state = storage::read(
        &state_path,
        json!({"accounts":[],"activeId":null,"fingerprint":null}),
    )?;
    let desktop = system::powershell(app, json!({"operation":"account-app-state","appId":id}))
        .unwrap_or(json!({"running":false,"version":""}));
    let version = desktop["version"].as_str().unwrap_or("");
    let compatible = supported(id, version);
    let (selected, _) = storage::selected_profile(&storage::settings(app)?, id, None)?;
    let client = network::client(selected.as_ref())?;
    let run = |auth: &Value| tauri::async_runtime::block_on(inspect(id, auth, &client));
    let current = read_current(id, &root);
    let mut state_persisted = false;
    let mut notice: Option<String> = None;
    if matches!(action, "list" | "import") {
        match &current {
            Ok(auth) => {
                let fingerprint = digest(auth.to_string().as_bytes());
                if state["fingerprint"].as_str() != Some(&fingerprint)
                    || action == "import"
                    || state["accounts"].as_array().is_some_and(|accounts| {
                        accounts.iter().any(|a| {
                            a["id"] == state["activeId"]
                                && a["checkedAt"].as_i64().unwrap_or(0) < now() - 300
                        })
                    })
                {
                    match run(auth) {
                        Ok(account) => {
                            let account_id =
                                account["id"].as_str().ok_or(error("protocol"))?.to_owned();
                            upsert_account(&mut state, account)?;
                            atomic(
                                &store.join(format!("{account_id}.dat")),
                                &dpapi(auth.to_string().as_bytes(), true)?,
                            )?;
                            state["activeId"] = json!(account_id);
                            state["fingerprint"] = json!(fingerprint);
                        }
                        Err(reason) => notice = Some(reason),
                    }
                }
            }
            Err(reason) => notice = Some(reason.clone()),
        }
    } else if action == "login" {
        system::powershell(app, json!({"operation":"account-app-open","appId":id}))?;
        notice = Some(error("signInInApp"));
    } else if matches!(action, "refresh" | "rename" | "delete" | "switch") {
        if action == "switch" {
            if !compatible {
                return Err(error("unsupportedVersion"));
            }
            if !switch_verified(id, version) {
                return Err(error("switchUnverified"));
            }
        }
        let account_id = payload["id"]
            .as_str()
            .filter(|s| {
                s.len() == 32
                    && s.starts_with("account-")
                    && s[8..].chars().all(|c| c.is_ascii_hexdigit())
            })
            .ok_or(error("credentialInvalid"))?;
        let index = state["accounts"]
            .as_array()
            .ok_or(error("storage"))?
            .iter()
            .position(|a| a["id"] == account_id)
            .ok_or(error("notFound"))?;
        let vault = store.join(format!("{account_id}.dat"));
        if action == "rename" {
            let name = payload["name"]
                .as_str()
                .map(str::trim)
                .filter(|s| !s.is_empty() && s.len() <= 240 && !s.chars().any(char::is_control))
                .ok_or(error("required"))?;
            state["accounts"][index]["name"] = json!(name);
        } else if action == "delete" {
            fs::remove_file(vault).map_err(|_| error("storage"))?;
            state["accounts"].as_array_mut().unwrap().remove(index);
            // The original signed-in application is untouched; the next scan may detect it again.
            if state["activeId"] == account_id {
                state["activeId"] = Value::Null;
            }
        } else {
            let mut auth: Value = serde_json::from_slice(&dpapi(&read_bytes(&vault)?, false)?)
                .map_err(|_| error("vault"))?;
            let active = current
                .as_ref()
                .ok()
                .and_then(|auth| local_identity(id, auth).ok())
                .map(|identity| identity.0);
            if action == "refresh" && active.as_deref() == Some(account_id) {
                auth = current.as_ref().unwrap().clone();
            }
            let mut checked = match run(&auth) {
                Ok(checked) => checked,
                Err(reason)
                    if action == "refresh"
                        && id == "qoder"
                        && compatible
                        && active.as_deref().is_some_and(|active| active != account_id)
                        && reason == error("loginRequired") =>
                {
                    // Only an inactive saved session can rotate here. The original app owns its
                    // active session and its own renewal; we never invalidate it behind its back.
                    auth = tauri::async_runtime::block_on(renew_qoder(&client, &auth))?;
                    // Rotation can consume the old refresh token. Retain the encrypted result even
                    // if the follow-up network read fails, so retry does not reuse a consumed token.
                    atomic(&vault, &dpapi(auth.to_string().as_bytes(), true)?)?;
                    run(&auth)?
                }
                Err(reason) => return Err(reason),
            };
            if checked["id"] != account_id {
                return Err(error("identityMismatch"));
            }
            if action == "refresh" {
                atomic(&vault, &dpapi(auth.to_string().as_bytes(), true)?)?;
            }
            checked["name"] = state["accounts"][index]["name"].clone();
            if action == "switch" {
                let before = current?;
                if state["fingerprint"].as_str() != Some(&digest(before.to_string().as_bytes())) {
                    return Err(error("externalChanged"));
                }
                let restart = desktop["running"] == true;
                if restart && payload["confirmRestart"] != true {
                    return Err(error("restartRequired"));
                }
                if restart {
                    system::powershell(app, json!({"operation":"account-app-close","appId":id}))?;
                }
                if !read_current(id, &root).is_ok_and(|current| current == before) {
                    if restart {
                        let _ = system::powershell(
                            app,
                            json!({"operation":"account-app-open","appId":id}),
                        );
                    }
                    return Err(error("externalChanged"));
                }
                let previous_state = state.clone();
                let mut next_state = state.clone();
                next_state["activeId"] = json!(account_id);
                next_state["fingerprint"] = json!(digest(auth.to_string().as_bytes()));
                next_state["accounts"][index] = checked.clone();
                let result = replace_and_verify(
                    || replace_auth(id, &root, &before, &auth),
                    || {
                        let written = read_current(id, &root)?;
                        if written != auth {
                            return Err(error("identityMismatch"));
                        }
                        run(&written)?;
                        storage::write(&state_path, &next_state)?;
                        if restart {
                            system::powershell(
                                app,
                                json!({"operation":"account-app-open","appId":id}),
                            )?;
                            let status = system::powershell(
                                app,
                                json!({"operation":"account-app-state","appId":id}),
                            )?;
                            if status["running"] != true {
                                return Err(error("restartFailed"));
                            }
                            let reopened = read_current(id, &root)?;
                            if local_identity(id, &reopened)?.0 != account_id {
                                return Err(error("identityMismatch"));
                            }
                            run(&reopened)?;
                        }
                        Ok(())
                    },
                    || {
                        if restart {
                            system::powershell(
                                app,
                                json!({"operation":"account-app-close","appId":id}),
                            )?;
                        }
                        restore_auth(id, &root, &auth, &before)?;
                        storage::write(&state_path, &previous_state)
                    },
                );
                if let Err(reason) = result {
                    if restart {
                        let _ = system::powershell(
                            app,
                            json!({"operation":"account-app-open","appId":id}),
                        );
                    }
                    return Err(reason);
                }
                state = next_state;
                state_persisted = true;
            }
            state["accounts"][index] = checked;
        }
    } else {
        return Err(error("unsupportedAction"));
    }
    if !state_persisted {
        storage::write(&state_path, &state)?;
    }
    Ok(
        json!({"appId":id,"accounts":state["accounts"],"activeId":state["activeId"],"notice":notice,"version":version,"supportedVersion":if id=="qoder"{"0.4.2"}else{"3.16.3"},"desktopRunning":desktop["running"],"capabilities":{"canImport":true,"canLogin":true,"canRefresh":true,"canSwitch":compatible && switch_verified(id, version)},"liveSwitchVerified":switch_verified(id, version)}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn authenticated_envelopes_reject_tampering() {
        let key = [7; 32];
        let (nonce, mut bytes) = encrypt(&key, b"synthetic credential").unwrap();
        assert_eq!(
            decrypt(&key, &nonce, &bytes).unwrap(),
            b"synthetic credential"
        );
        bytes[0] ^= 1;
        assert!(decrypt(&key, &nonce, &bytes).is_err());
    }
    #[test]
    #[cfg(windows)]
    fn vault_roundtrip_handles_credentials_larger_than_a_pipe_buffer() {
        let original = vec![42; 48 * 1024];
        let encrypted = dpapi(&original, true).unwrap();
        assert_eq!(dpapi(&encrypted, false).unwrap(), original);
    }
    #[test]
    fn identity_is_stable_and_versions_are_explicit() {
        let auth = json!({"user":{"id":"synthetic","email":"person@example.invalid"}});
        assert_eq!(local_identity("qoder", &auth).unwrap().0.len(), 32);
        assert!(supported("qoder", "0.4.2"));
        assert!(!supported("qoder", "0.4.3"));
    }
    #[test]
    fn zcode_cipher_keeps_non_auth_settings_outside_scope() {
        assert!(auth_key("oauth:zai:user_info"));
        assert!(!auth_key("oauth:bigmodel:access_token"));
        assert!(!auth_key("project-key-location:unrelated"));
        assert!(!auth_key("setting.json"));
        assert!(zcode_decode("enc:v1:bad", &[0; 32]).is_err());
    }
    #[test]
    fn transaction_restores_after_write_or_identity_failure() {
        use std::cell::Cell;
        for write_fails in [true, false] {
            let state = Cell::new(1);
            let result = replace_and_verify(
                || {
                    state.set(2);
                    if write_fails {
                        Err(error("storage"))
                    } else {
                        Ok(())
                    }
                },
                || Err::<(), _>(error("identityMismatch")),
                || {
                    state.set(1);
                    Ok(())
                },
            );
            assert!(result.is_err());
            assert_eq!(state.get(), 1);
        }
        assert_eq!(
            replace_and_verify(
                || Ok(()),
                || Err::<(), _>(error("identityMismatch")),
                || Err(error("storage"))
            )
            .unwrap_err(),
            error("rollbackFailed")
        );
        assert_eq!(
            replace_and_verify(
                || Err(error("externalChanged")),
                || Ok(()),
                || panic!("No write occurred; do not overwrite external state")
            )
            .unwrap_err(),
            error("externalChanged")
        );
    }
    #[test]
    fn repeated_detection_deduplicates_and_preserves_user_name() {
        let mut state = json!({"accounts":[]});
        upsert_account(
            &mut state,
            json!({"id":"one","name":"Personal","plan":"free"}),
        )
        .unwrap();
        upsert_account(
            &mut state,
            json!({"id":"one","name":"Remote name","plan":"pro"}),
        )
        .unwrap();
        assert_eq!(state["accounts"].as_array().unwrap().len(), 1);
        assert_eq!(state["accounts"][0]["name"], "Personal");
        assert_eq!(state["accounts"][0]["plan"], "pro");
        assert!(token("qoder", &json!({"token":""})).is_err());
    }
    #[test]
    fn zcode_balances_keep_units_and_reject_invalid_or_expired_limits() {
        let data = json!({"code":0,"data":{"server_time":100,"balances":[
            {"show_name":"Daily tokens","unit_type":"tokens","remaining_units":"0","total_units":"300000000","used_units":"300000000","expires_at":200},
            {"show_name":"Expired","unit_type":"tokens","remaining_units":2,"expires_at":90},
            {"show_name":"Invalid","unit_type":"tokens","remaining_units":-1},
            {"show_name":"Reserved","unit_type":"tokens","available_units":17,"reserved_units":3}
        ]}});
        let usage = zcode_balances(&data).unwrap();
        assert_eq!(usage.len(), 1);
        assert_eq!(usage[0]["remaining"], 0.0);
        assert_eq!(usage[0]["unit"], "tokens");
        assert!(zcode_balances(&json!({"code":3001,"msg":"parameter error"})).is_err());
        assert!(zcode_balances(&json!({"code":0,"data":{}})).is_err());
    }
    #[test]
    fn qoder_renewal_requires_complete_response_and_keeps_identity() {
        let auth = json!({"user":{"id":"synthetic"},"token":"old","refreshToken":"old-refresh","expiresAt":"2020-01-01T00:00:00Z"});
        let next=qoder_renewed(&auth,&json!({"device_token":"new","refresh_token":"new-refresh","expires_in":3600,"refresh_token_expires_in":7200}),1000).unwrap();
        assert_eq!(next["user"], auth["user"]);
        assert_eq!(next["token"], "new");
        assert_eq!(timestamp(&next["expiresAt"]), Some(4600));
        assert!(qoder_renewed(&auth, &json!({"token":"new"}), 1000).is_err());
        assert!(qoder_renewed(
            &auth,
            &json!({"token":"new","refresh_token":"refresh","expires_in":-1}),
            1000
        )
        .is_err());
    }
    #[test]
    fn qoder_renewal_http_contract_has_no_access_token_and_handles_rejection() {
        use std::io::Read;
        for status in [200, 401] {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
            let url = format!("http://{}/refresh", listener.local_addr().unwrap());
            let server = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut request = Vec::new();
                let mut chunk = [0; 4096];
                loop {
                    let read = stream.read(&mut chunk).unwrap();
                    assert!(read > 0);
                    request.extend_from_slice(&chunk[..read]);
                    let text = String::from_utf8_lossy(&request);
                    if let Some(end) = text.find("\r\n\r\n") {
                        let length = text[..end]
                            .lines()
                            .find_map(|line| {
                                line.to_ascii_lowercase()
                                    .strip_prefix("content-length:")
                                    .and_then(|value| value.trim().parse::<usize>().ok())
                            })
                            .unwrap();
                        if request.len() >= end + 4 + length {
                            break;
                        }
                    }
                }
                let text = String::from_utf8(request).unwrap();
                assert!(!text.to_ascii_lowercase().contains("authorization:"));
                let body: Value =
                    serde_json::from_str(text.split("\r\n\r\n").nth(1).unwrap()).unwrap();
                assert_eq!(body, json!({"refresh_token":"synthetic-refresh"}));
                let response = r#"{"token":"synthetic-next","refresh_token":"synthetic-next-refresh","expires_in":3600}"#;
                write!(stream,"HTTP/1.1 {status} Test\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response}",response.len()).unwrap();
            });
            let auth = json!({"user":{"id":"synthetic"},"token":"synthetic-access","refreshToken":"synthetic-refresh"});
            let client =
                network::client(Some(&json!({"id":"test","name":"Direct","mode":"direct"})))
                    .unwrap();
            let result = tauri::async_runtime::block_on(renew_qoder_at(&client, &auth, &url));
            if status == 200 {
                assert_eq!(result.unwrap()["token"], "synthetic-next");
            } else {
                assert_eq!(result.unwrap_err(), error("loginRequired"));
            }
            server.join().unwrap();
        }
    }
    #[test]
    fn vendor_lock_and_compare_exchange_keep_external_edits_and_non_auth_values() {
        let root = std::env::temp_dir().join(format!(
            "vibehub-adapter-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
        fs::create_dir(&root).unwrap();
        #[cfg(windows)]
        {
            let lock = CredentialLock::acquire("qoder", &root).unwrap();
            assert!(
                fs::remove_file(root.join("auth.v1.lock")).is_err(),
                "A live Qoder lease must not be stolen as a stale file"
            );
            drop(lock);
            assert!(!root.join("auth.v1.lock").exists());
        }
        let before = json!({"oauth:active_provider":"zai","oauth:zai:user_info":"{\"user_id\":\"one\"}","zcodejwttoken":"synthetic-before"});
        let after = json!({"oauth:active_provider":"zai","oauth:zai:user_info":"{\"user_id\":\"two\"}","zcodejwttoken":"synthetic-after"});
        fs::write(
            root.join("credentials.json"),
            json!({"project-key-location:keep":"opaque-value"}).to_string(),
        )
        .unwrap();
        write_current("zcode", &root, &before).unwrap();
        {
            let _lock = CredentialLock::acquire("zcode", &root).unwrap();
            assert!(replace_auth("zcode", &root, &before, &after).is_err());
        }
        replace_auth("zcode", &root, &before, &after).unwrap();
        assert_eq!(
            read_json(&root.join("credentials.json")).unwrap()["project-key-location:keep"],
            "opaque-value"
        );
        assert!(replace_auth("zcode", &root, &before, &before).is_err());
        assert_eq!(read_current("zcode", &root).unwrap(), after);
        replace_auth("zcode", &root, &after, &before).unwrap();
        assert_eq!(read_current("zcode", &root).unwrap(), before);
        fs::remove_file(root.join("credentials.json")).unwrap();
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn zcode_identity_must_match_authenticated_token() {
        let jwt = format!(
            "header.{}.signature",
            URL_SAFE_NO_PAD.encode(br#"{"user_id":"one","sub":"one"}"#)
        );
        let mut auth = json!({"oauth:active_provider":"zai","zcodejwttoken":jwt,"oauth:zai:user_info":"{\"user_id\":\"one\"}"});
        assert!(verify_zcode_identity(&auth).is_ok());
        auth["oauth:zai:user_info"] = json!("{\"user_id\":\"two\"}");
        assert!(verify_zcode_identity(&auth).is_err());
        assert!(!switch_verified("qoder", "0.4.2"));
    }
    #[test]
    #[ignore = "Reads the signed-in desktop accounts and makes read-only vendor requests; no profile is modified"]
    fn live_read_only_accounts() {
        for id in ["qoder", "zcode"] {
            let auth = read_current(id, &profile(id).unwrap()).unwrap();
            let client = network::client(None).unwrap();
            let snapshot = tauri::async_runtime::block_on(inspect(id, &auth, &client)).unwrap();
            assert!(snapshot["id"].as_str().unwrap().starts_with("account-"));
            assert!(snapshot.get("token").is_none());
            if id == "zcode" && !snapshot["quotaError"].is_null() {
                println!("zcode: identity and granted entitlements verified; remaining balance unavailable");
            } else {
                println!("{id}: identity and live usage verified");
            }
        }
    }
}
