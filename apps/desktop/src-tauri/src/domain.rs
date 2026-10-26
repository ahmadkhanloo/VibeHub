use serde_json::Value;

pub type Result<T> = std::result::Result<T, String>;
pub const APP_IDS: [&str; 6] = [
    "zcode",
    "qoder",
    "deepseek-harness",
    "opencode",
    "mimocode",
    "freebuff",
];

pub fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

pub fn field<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v.get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| format!("Missing string: {key}"))
}

pub fn validate_profile(v: &Value) -> Result<()> {
    if !identifier(field(v, "id")?) || field(v, "name")?.trim().is_empty() {
        return Err("Invalid profile identity".into());
    }
    for key in v.as_object().ok_or("Expected profile object")?.keys() {
        if ![
            "id",
            "name",
            "mode",
            "host",
            "port",
            "username",
            "hasPassword",
        ]
        .contains(&key.as_str())
        {
            return Err("Unknown profile field".into());
        }
    }
    match field(v, "mode")? {
        "direct" | "system" => (),
        "http" | "socks5" => {
            let host = field(v, "host")?;
            if host.is_empty()
                || host
                    .chars()
                    .any(|c| c.is_whitespace() || "/\\@?#".contains(c))
                || host.contains("://")
            {
                return Err("Invalid proxy host".into());
            }
            let port = v["port"].as_u64().ok_or("Invalid proxy port")?;
            if !(1..=65535).contains(&port) {
                return Err("Invalid proxy port".into());
            }
            let scheme = if v["mode"] == "socks5" {
                "socks5h"
            } else {
                "http"
            };
            reqwest::Url::parse(&format!("{scheme}://{host}:{port}"))
                .map_err(|_| "Invalid proxy address")?;
        }
        _ => return Err("Unknown proxy mode".into()),
    }
    Ok(())
}

pub fn validate_config(cfg: &Value, profiles: &[Value]) -> Result<()> {
    let required = cfg["requireProxy"]
        .as_bool()
        .ok_or("requireProxy must be boolean")?;
    let global = field(cfg, "globalProfileId")?;
    let per_app = cfg["perApp"]
        .as_object()
        .ok_or("perApp must be an object")?;
    for id in
        std::iter::once(global).chain(per_app.values().map(|v| v.as_str().unwrap_or("!invalid")))
    {
        if id == "inherit" {
            continue;
        }
        if id.is_empty() && !required {
            continue;
        }
        let profile = profiles
            .iter()
            .find(|p| p["id"] == id)
            .ok_or("Proxy profile does not exist")?;
        if required && !matches!(profile["mode"].as_str(), Some("http" | "socks5")) {
            return Err("Required proxy must use an explicit HTTP or SOCKS5 profile".into());
        }
    }
    if per_app
        .keys()
        .any(|id| id != "*" && !APP_IDS.contains(&id.as_str()))
    {
        return Err("Unknown app in proxy configuration".into());
    }
    Ok(())
}

pub fn safe_url(value: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(value).map_err(|_| "Invalid URL")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if !(url.scheme() == "https" || (local && url.scheme() == "http"))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.query().is_some()
    {
        return Err("Use HTTPS, or loopback HTTP, without credentials, query or fragment".into());
    }
    Ok(url)
}

pub fn validate_index(index: &Value) -> Result<()> {
    if index["schemaVersion"] != 1 {
        return Err("Unsupported content schema".into());
    }
    let date = field(index, "generatedAt")?;
    if chrono::DateTime::parse_from_rfc3339(date).is_err()
        && chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d").is_err()
    {
        return Err("Invalid content date".into());
    }
    if let Some(min) = index.get("minClientVersion") {
        let min = semver::Version::parse(min.as_str().ok_or("Invalid client version")?)
            .map_err(|_| "Invalid client version")?;
        let current = semver::Version::parse(env!("CARGO_PKG_VERSION"))
            .map_err(|_| "Invalid build version")?;
        if min > current {
            return Err("Content requires a newer client".into());
        }
    }
    for key in ["apps", "providers", "offers"] {
        let entries = index[key].as_array().ok_or("Missing content array")?;
        if entries.len() > 100 {
            return Err("Content index too large".into());
        }
        let mut seen = std::collections::HashSet::new();
        for id in entries {
            let id = id.as_str().ok_or("Invalid content identifier")?;
            if !identifier(id) || !seen.insert(id) {
                return Err("Unsafe or duplicate content identifier".into());
            }
        }
    }
    Ok(())
}

// Package names never come from remote content or arbitrary UI strings.
// Apps without an audited package mapping retain their official guide path.
pub fn install_spec(app: &str, method: &str, package: Option<&str>) -> Result<&'static str> {
    match (app, method, package) {
        ("terminal", "winget", None) => Ok("JanDeDobbeleer.OhMyPosh"),
        _ => Err(
            "No audited package mapping for this app. Use its official installation guide.".into(),
        ),
    }
}
