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
    // Share Tauri updater's ring provider, including debug builds without the updater plugin.
    let _ = rustls::crypto::ring::default_provider().install_default();
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
        let username = profile["username"].as_str().unwrap_or("");
        let password = storage::vault_get(&format!("vibehub.proxy.{}", field(profile, "id")?))?;
        let has_credentials = !username.is_empty() || password.is_some();
        if has_credentials && (username.is_empty() || password.is_none()) {
            return Err("SOCKS5 requires both a username and a stored password".into());
        }
        let methods = if has_credentials { [5, 1, 2] } else { [5, 1, 0] };
        stream.write_all(&methods).map_err(|_| "SOCKS greeting failed")?;
        let mut reply = [0u8; 2];
        stream
            .read_exact(&mut reply)
            .map_err(|_| "SOCKS response failed")?;
        if reply[0] != 5 {
            return Err("Invalid SOCKS response".into());
        }
        match reply[1] {
            0 if !has_credentials => (),
            2 if has_credentials => {
                let username = username.as_bytes();
                let password = password.as_deref().unwrap_or_default().as_bytes();
                if username.is_empty() || username.len() > 255 || password.is_empty() || password.len() > 255 {
                    return Err("SOCKS5 username and password must each be 1 to 255 bytes".into());
                }
                let mut auth = Vec::with_capacity(username.len() + password.len() + 3);
                auth.extend_from_slice(&[1, username.len() as u8]);
                auth.extend_from_slice(username);
                auth.push(password.len() as u8);
                auth.extend_from_slice(password);
                stream.write_all(&auth).map_err(|_| "SOCKS authentication failed")?;
                let mut auth_reply = [0u8; 2];
                stream.read_exact(&mut auth_reply).map_err(|_| "SOCKS authentication response failed")?;
                if auth_reply != [1, 0] {
                    return Err("SOCKS5 authentication was rejected".into());
                }
            }
            0 => return Err("SOCKS5 did not request the configured credentials".into()),
            2 => return Err("SOCKS5 proxy requires a username and password".into()),
            _ => return Err("SOCKS authentication method was rejected".into()),
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

pub async fn connection_test(connection: Value, profile: Option<Value>) -> Result<Value> {
    crate::domain::validate_provider_connection(&connection)?;
    let id = field(&connection, "id")?;
    let provider = field(&connection, "providerId")?;
    let model = field(&connection, "modelId")?;
    let base = safe_url(field(&connection, "baseUrl")?)?;
    let service = format!("vibehub.provider-key.connection.{id}");
    let needs_key = provider != "ollama";
    let secret = if needs_key {
        storage::vault_get(&service)?
    } else {
        None
    };
    if needs_key && secret.is_none() {
        return Ok(json!({
            "dnsResolved":false,"httpResponse":false,"authValidated":false,"modelResponded":false,
            "redactedError":"Save an API key for this connection before testing"
        }));
    }

    let client = client(profile.as_ref())?;
    let base = base.as_str().trim_end_matches('/');
    let is_anthropic = provider == "anthropic";
    let is_google = matches!(provider, "google" | "gemini");
    let (endpoint, body) = if is_google {
        let mut endpoint = base.parse::<reqwest::Url>().map_err(|_| "Invalid provider URL")?;
        endpoint.path_segments_mut().map_err(|_| "Invalid provider URL")?
            .push("models").push(&format!("{model}:generateContent"));
        (
            endpoint.to_string(),
            json!({"contents":[{"parts":[{"text":"Reply with OK."}]}],"generationConfig":{"maxOutputTokens":8}}),
        )
    } else if is_anthropic {
        (
            format!("{base}/messages"),
            json!({"model":model,"max_tokens":8,"messages":[{"role":"user","content":"Reply with OK."}]}),
        )
    } else {
        (
            format!("{base}/chat/completions"),
            json!({"model":model,"messages":[{"role":"user","content":"Reply with OK."}],"max_tokens":8,"stream":false}),
        )
    };
    let mut request = client.post(endpoint).json(&body);
    if let Some(key) = secret.as_deref() {
        request = if is_anthropic {
            request.header("x-api-key", key).header("anthropic-version", "2023-06-01")
        } else if is_google {
            request.header("x-goog-api-key", key)
        } else {
            request.bearer_auth(key)
        };
    }
    match request.send().await {
        Ok(response) => {
            let status = response.status();
            let response_body = bounded_json(response, 1024 * 1024).await.ok();
            let responded = status.is_success() && response_body.as_ref().is_some_and(|body| {
                if is_google {
                    body["candidates"].as_array().is_some_and(|items| items.iter().any(|item|
                        item["content"]["parts"].as_array().is_some_and(|parts| parts.iter().any(|part| part["text"].is_string()))
                    ))
                } else if is_anthropic {
                    body["content"].as_array().is_some_and(|items| items.iter().any(|item| item["type"] == "text" && item["text"].is_string()))
                } else {
                    body["choices"].as_array().is_some_and(|items| items.iter().any(|item| item["message"]["content"].is_string()))
                }
            });
            Ok(json!({
                "dnsResolved":true,"httpResponse":true,"authValidated":!needs_key || (secret.is_some() && status.is_success()),
                "modelResponded":responded,"httpStatus":status.as_u16(),
                "redactedError":if responded { Value::Null } else { json!("Provider returned an error or an invalid model response") }
            }))
        }
        Err(error) => Ok(json!({
            "dnsResolved":false,"httpResponse":false,"authValidated":false,"modelResponded":false,
            "redactedError":if error.is_timeout() { "Request timed out" } else { "Connection or TLS failed; DNS status is unconfirmed" }
        })),
    }
}

async fn bounded_bytes(mut response: reqwest::Response, limit: usize) -> Result<Vec<u8>> {
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
    Ok(bytes)
}

async fn bounded_json(response: reqwest::Response, limit: usize) -> Result<Value> {
    serde_json::from_slice(&bounded_bytes(response, limit).await?)
        .map_err(|_| "Invalid JSON response".into())
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
    let mut guides = serde_json::Map::new();
    for id in index["apps"].as_array().ok_or("Missing apps")? {
        let id = id.as_str().ok_or("Invalid app id")?;
        for lang in ["fa", "en"] {
            let response = client
                .get(format!("{root}guides/{id}/{lang}.md"))
                .send()
                .await
                .map_err(|_| "Feed guide unavailable")?;
            if !response.status().is_success() {
                return Err("Feed guide returned an HTTP error".into());
            }
            let text = String::from_utf8(bounded_bytes(response, 128 * 1024).await?)
                .map_err(|_| "Feed guide is not UTF-8")?;
            guides.insert(format!("{id}/{lang}"), json!(text));
        }
    }
    // The UI applies the shared strict Zod schemas before accepting this data.
    // Downloads never provide executable commands or package mappings.
    Ok(
        json!({"ok":true,"updated":true,"detail":"Downloaded feed; shared schema validation required before use","generatedAt":index["generatedAt"],"catalog":catalog,"guides":guides}),
    )
}
