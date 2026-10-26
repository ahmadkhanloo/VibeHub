use crate::{
    domain::{Result, field, safe_url, validate_index, validate_profile},
    storage,
};
use base64::{Engine, prelude::BASE64_STANDARD};
use serde_json::{Value, json};
use std::{
    net::{TcpStream, ToSocketAddrs},
    time::Duration,
};

pub fn proxy_url(profile: &Value) -> Result<String> {
    validate_profile(profile)?;
    let scheme = if profile["mode"] == "socks5" {
        "socks5h"
    } else {
        "http"
    };
    Ok(format!(
        "{scheme}://{}:{}",
        field(profile, "host")?,
        profile["port"]
    ))
}

pub fn client(profile: Option<&Value>) -> Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .connect_timeout(Duration::from_secs(6))
        .redirect(reqwest::redirect::Policy::none());
    if let Some(p) = profile {
        validate_profile(p)?;
        match field(p, "mode")? {
            "direct" => builder = builder.no_proxy(),
            "http" | "socks5" => {
                let mut proxy = reqwest::Proxy::all(proxy_url(p)?).map_err(|_| "Invalid proxy")?;
                if let Some(password) =
                    storage::vault_get(&format!("vibehub.proxy.{}", field(p, "id")?))?
                {
                    proxy = proxy.basic_auth(p["username"].as_str().unwrap_or(""), &password);
                }
                builder = builder.no_proxy().proxy(proxy);
            }
            "system" => (),
            _ => return Err("Unknown proxy mode".into()),
        }
    }
    builder
        .build()
        .map_err(|_| "Could not initialize HTTP client".into())
}

fn connect(profile: &Value) -> Result<TcpStream> {
    let host = field(profile, "host")?.trim_matches(['[', ']']);
    let port = profile["port"].as_u64().ok_or("Missing port")? as u16;
    let addresses = (host, port)
        .to_socket_addrs()
        .map_err(|_| "Proxy DNS lookup failed")?;
    for address in addresses {
        if let Ok(stream) = TcpStream::connect_timeout(&address, Duration::from_secs(3)) {
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .map_err(|_| "Socket timeout failed")?;
            stream
                .set_write_timeout(Some(Duration::from_secs(5)))
                .map_err(|_| "Socket timeout failed")?;
            return Ok(stream);
        }
    }
    Err("Could not connect to proxy TCP port".into())
}

fn handshake(profile: &Value) -> Result<()> {
    use std::io::{Read, Write};
    let mut stream = connect(profile)?;
    if profile["mode"] == "socks5" {
        // Negotiation proves SOCKS support. Authenticated request is tested separately.
        stream
            .write_all(&[5, 1, 0])
            .map_err(|_| "SOCKS greeting failed")?;
        let mut reply = [0u8; 2];
        stream
            .read_exact(&mut reply)
            .map_err(|_| "SOCKS response failed")?;
        if reply != [5, 0] {
            return Err("SOCKS handshake requires authentication or was rejected".into());
        }
    } else {
        let password = storage::vault_get(&format!("vibehub.proxy.{}", field(profile, "id")?))?;
        let auth = password
            .map(|p| {
                format!(
                    "Proxy-Authorization: Basic {}\r\n",
                    BASE64_STANDARD.encode(format!(
                        "{}:{p}",
                        profile["username"].as_str().unwrap_or("")
                    ))
                )
            })
            .unwrap_or_default();
        let request =
            format!("CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n{auth}\r\n");
        stream
            .write_all(request.as_bytes())
            .map_err(|_| "HTTP proxy handshake failed")?;
        let mut response = [0u8; 512];
        let size = stream
            .read(&mut response)
            .map_err(|_| "HTTP proxy response failed")?;
        let status = String::from_utf8_lossy(&response[..size])
            .lines()
            .next()
            .unwrap_or("")
            .to_owned();
        if status.split_whitespace().nth(1) != Some("200") {
            return Err("HTTP CONNECT tunnel rejected".into());
        }
    }
    Ok(())
}

pub async fn proxy_test(profile: Value, level: String) -> Result<Value> {
    validate_profile(&profile)?;
    if !["tcp", "handshake", "request"].contains(&level.as_str()) {
        return Err("Invalid test level".into());
    }
    let result = if level == "request" {
        match client(Some(&profile))?
            .get("https://example.com/")
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => Ok(()),
            _ => Err("HTTPS request through selected proxy failed".into()),
        }
    } else if matches!(profile["mode"].as_str(), Some("direct" | "system")) {
        Err("TCP and handshake tests require an explicit proxy".into())
    } else {
        let p = profile.clone();
        let handshake_level = level == "handshake";
        tauri::async_runtime::spawn_blocking(move || {
            if handshake_level {
                handshake(&p)
            } else {
                connect(&p).map(|_| ())
            }
        })
        .await
        .map_err(|_| "Proxy test task failed")?
    };
    Ok(
        json!({"level":level,"ok":result.is_ok(),"detail":result.err().unwrap_or_else(|| "Test passed".into()),"testedAt":chrono::Utc::now().to_rfc3339()}),
    )
}

pub async fn api_test(
    profile: Option<Value>,
    provider: String,
    base: String,
    model: String,
    service: String,
) -> Result<Value> {
    if service != format!("vibehub.provider-key.{provider}")
        || !crate::domain::identifier(&provider)
    {
        return Err("Provider and vault service do not match".into());
    }
    if model.trim().is_empty() || model.len() > 256 || model.chars().any(char::is_control) {
        return Err("Invalid model identifier".into());
    }
    let url = safe_url(&base)?;
    let endpoint = format!("{}/chat/completions", url.as_str().trim_end_matches('/'));
    let secret = storage::vault_get(&service)?;
    let has_secret = secret.is_some();
    let mut request = client(profile.as_ref())?.post(endpoint).json(&json!({"model":model,"messages":[{"role":"user","content":"Reply with OK."}],"max_tokens":8,"stream":false}));
    if let Some(key) = secret {
        request = request.bearer_auth(key);
    }
    match request.send().await {
        Ok(response) => {
            let status = response.status();
            let body = bounded_json(response, 1024 * 1024).await.ok();
            let responded = status.is_success()
                && body
                    .as_ref()
                    .and_then(|v| v["choices"].as_array())
                    .is_some_and(|a| a.iter().any(|v| v["message"]["content"].is_string()));
            Ok(
                json!({"dnsResolved":true,"httpResponse":true,"authValidated":has_secret && responded,"modelResponded":responded,"httpStatus":status.as_u16(),"redactedError": if responded { Value::Null } else { json!("Provider returned an error or an invalid model response") }}),
            )
        }
        Err(error) => Ok(
            json!({"dnsResolved":false,"httpResponse":false,"authValidated":false,"modelResponded":false,"redactedError": if error.is_timeout() { "Request timed out" } else { "Connection or TLS failed; DNS status is unconfirmed" }}),
        ),
    }
}

async fn bounded_json(mut response: reqwest::Response, limit: usize) -> Result<Value> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Content download interrupted")?
    {
        if bytes.len() + chunk.len() > limit {
            return Err("Content exceeds size limit".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes).map_err(|_| "Invalid JSON response".into())
}

pub async fn feed_sync(profile: Option<Value>, base: String) -> Result<Value> {
    let base = safe_url(&base)?;
    let client = client(profile.as_ref())?;
    let root = format!("{}/", base.as_str().trim_end_matches('/'));
    let response = client
        .get(format!("{root}index.json"))
        .send()
        .await
        .map_err(|_| "Feed unavailable; keeping current content")?;
    if !response.status().is_success() {
        return Err("Feed index returned an HTTP error".into());
    }
    let index = bounded_json(response, 128 * 1024).await?;
    validate_index(&index)?;
    let mut catalog = json!({"apps":[],"providers":[],"offers":[]});
    for kind in ["apps", "providers", "offers"] {
        for id in index[kind].as_array().ok_or("Missing content list")? {
            let id = id.as_str().ok_or("Invalid content id")?;
            let response = client
                .get(format!("{root}{kind}/{id}.json"))
                .send()
                .await
                .map_err(|_| "Feed document unavailable")?;
            if !response.status().is_success() {
                return Err("Feed document returned an HTTP error".into());
            }
            let document = bounded_json(response, 256 * 1024).await?;
            if document["schemaVersion"] != 1
                || document[if kind == "offers" { "offerId" } else { "id" }] != id
            {
                return Err("Feed document identity or schema mismatch".into());
            }
            catalog[kind]
                .as_array_mut()
                .ok_or("Invalid content list")?
                .push(document);
        }
    }
    // The UI applies the shared strict Zod schemas before accepting this data.
    // Downloads never provide executable commands or package mappings.
    Ok(
        json!({"ok":true,"updated":true,"detail":"Downloaded feed; shared schema validation required before use","generatedAt":index["generatedAt"],"catalog":catalog}),
    )
}
