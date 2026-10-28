#[path = "../src/domain.rs"]
#[allow(dead_code)]
mod domain;
#[path = "../src/network.rs"]
#[allow(dead_code)]
mod network;
#[path = "../src/storage.rs"]
#[allow(dead_code)]
mod storage;
#[path = "../src/system.rs"]
#[allow(dead_code)]
mod system;

use domain::*;
use serde_json::json;

#[test]
fn proxy_validation_rejects_injection_and_invalid_ports() {
    assert!(
        validate_profile(
            &json!({"id":"p", "name":"test", "mode":"http", "host":"127.0.0.1", "port":1080})
        )
        .is_ok()
    );
    for host in ["http://example.com", "a\r\nb", "user@host", "a/b"] {
        assert!(
            validate_profile(
                &json!({"id":"p", "name":"test", "mode":"http", "host":host, "port":1080})
            )
            .is_err()
        );
    }
    assert!(validate_profile(&json!({"id":"../p", "name":"test", "mode":"direct"})).is_err());
    assert!(
        validate_profile(
            &json!({"id":"p", "name":"test", "mode":"http", "host":"localhost", "port":0})
        )
        .is_err()
    );
}

#[test]
fn provider_connections_require_safe_urls_ids_and_model_names() {
    let valid = json!({
        "id":"connection-1",
        "name":"OpenRouter free",
        "providerId":"openrouter",
        "baseUrl":"https://openrouter.ai/api/v1",
        "modelId":"openai/gpt-oss-20b:free",
        "hasKey":true
    });
    assert!(validate_provider_connection(&valid).is_ok());
    for invalid in [
        json!({"id":"../x","name":"x","providerId":"openrouter","baseUrl":"https://example.com/v1","modelId":"m"}),
        json!({"id":"x","name":"x","providerId":"openrouter","baseUrl":"http://example.com/v1","modelId":"m"}),
        json!({"id":"x","name":"x","providerId":"openrouter","baseUrl":"https://example.com/v1?key=secret","modelId":"m"}),
        json!({"id":"x","name":"x","providerId":"openrouter","baseUrl":"https://example.com/v1","modelId":"\n"}),
        json!({"id":"x","name":"x","providerId":"openrouter","baseUrl":"https://example.com/v1","modelId":"m","apiKey":"must-not-be-stored"}),
    ] {
        assert!(
            validate_provider_connection(&invalid).is_err(),
            "accepted {invalid}"
        );
    }
}

#[test]
fn provider_connection_metadata_survives_reload_without_persisting_a_secret() {
    let path = std::env::temp_dir().join(format!("vibehub-providers-{}.json", std::process::id()));
    let _ = std::fs::remove_file(&path);
    let connection = json!({
        "id":"saved-one","name":"My local model","providerId":"ollama",
        "baseUrl":"http://127.0.0.1:11434/v1","modelId":"qwen2.5-coder:7b","hasKey":true
    });
    let saved = storage::save_provider_connection(&path, connection, None).unwrap();
    assert_eq!(saved[0]["hasKey"], false);
    let loaded = storage::provider_connections(&path).unwrap();
    assert_eq!(loaded[0]["name"], "My local model");
    assert_eq!(loaded[0]["modelId"], "qwen2.5-coder:7b");
    assert_eq!(
        loaded[0]["hasKey"], false,
        "stale metadata must not claim a secret exists in the vault"
    );
    assert!(!std::fs::read_to_string(&path).unwrap().contains("apiKey"));
    std::fs::remove_file(path).unwrap();
}

#[test]
fn credential_inventory_is_read_only_and_never_returns_secrets() {
    let path = std::env::temp_dir().join(format!("vibehub-inventory-{}.json", std::process::id()));
    let value = json!([{"id":"local","name":"Local","providerId":"ollama","baseUrl":"http://127.0.0.1:11434/v1","modelId":"qwen","hasKey":true}]);
    storage::write(&path, &value).unwrap();
    let bytes = std::fs::read(&path).unwrap();
    let mut reads = Vec::new();
    let inventory = storage::provider_credentials_inventory_with(&path, |service| {
        reads.push(service.to_owned());
        Ok(service == "vibehub.provider-key.openrouter")
    })
    .unwrap();
    assert_eq!(std::fs::read(&path).unwrap(), bytes);
    assert_eq!(inventory["connections"][0]["hasKey"], false);
    assert_eq!(inventory["legacyProviderIds"], json!(["openrouter"]));
    assert!(!inventory.to_string().contains("apiKey"));
    assert!(!reads.iter().any(|service| service.contains("proxy")));
    std::fs::remove_file(path).unwrap();
}

#[test]
fn failed_legacy_delete_blocks_connections_and_reports_partial_progress() {
    let path =
        std::env::temp_dir().join(format!("vibehub-clear-legacy-{}.json", std::process::id()));
    let value = json!([{"id":"one","name":"Saved","providerId":"openrouter","baseUrl":"https://openrouter.ai/api/v1","modelId":"test","hasKey":true}]);
    storage::write(&path, &value).unwrap();
    let mut deleted = Vec::new();
    let report = storage::provider_credentials_clear_with(
        &path,
        &["one".into()],
        &["openrouter".into(), "nvidia-build".into()],
        |service| {
            deleted.push(service.to_owned());
            if service.ends_with("nvidia-build") {
                Err("Simulated vault unavailable".into())
            } else {
                Ok(())
            }
        },
    )
    .unwrap();
    assert_eq!(report["deletedLegacyProviderIds"], json!(["openrouter"]));
    assert!(
        report["deletedConnectionIds"]
            .as_array()
            .unwrap()
            .is_empty()
    );
    assert_eq!(storage::read(&path, json!([])).unwrap(), value);
    assert!(
        !deleted
            .iter()
            .any(|service| service.contains("connection."))
    );
    assert_eq!(report["failures"].as_array().unwrap().len(), 2);
    std::fs::remove_file(path).unwrap();
}

#[test]
fn credential_delete_retains_metadata_on_vault_failure_and_is_scoped() {
    let path = std::env::temp_dir().join(format!("vibehub-clear-key-{}.json", std::process::id()));
    let value = json!([{"id":"one","name":"Saved","providerId":"openai","baseUrl":"https://api.openai.com/v1","modelId":"test","hasKey":true}]);
    storage::write(&path, &value).unwrap();
    let failed = storage::provider_credentials_clear_with(&path, &["one".into()], &[], |_| {
        Err("Simulated failure".into())
    })
    .unwrap();
    assert_eq!(failed["failures"][0]["kind"], "connection");
    assert_eq!(storage::read(&path, json!([])).unwrap(), value);
    let mut deleted = Vec::new();
    let done = storage::provider_credentials_clear_with(&path, &["one".into()], &[], |service| {
        deleted.push(service.to_owned());
        Ok(())
    })
    .unwrap();
    assert_eq!(deleted, vec!["vibehub.provider-key.connection.one"]);
    assert_eq!(done["deletedConnectionIds"], json!(["one"]));
    assert_eq!(storage::read(&path, json!([])).unwrap(), json!([]));
    assert!(
        storage::provider_credentials_clear_with(&path, &[], &["other-app".into()], |_| panic!(
            "invalid IDs must be rejected before deletion"
        ))
        .is_err()
    );
    let again = storage::provider_credentials_clear_with(&path, &["one".into()], &[], |_| {
        panic!("already removed metadata must not target new credentials")
    })
    .unwrap();
    assert_eq!(again["deletedConnectionIds"], json!(["one"]));
    std::fs::remove_file(path).unwrap();
}

#[test]
fn credential_delete_reports_metadata_failure_and_reconciles_the_removed_key() {
    let directory =
        std::env::temp_dir().join(format!("vibehub-delete-write-{}", std::process::id()));
    let path = directory.join("connections.json");
    let value = json!([{"id":"one","name":"Saved","providerId":"openai","baseUrl":"https://api.openai.com/v1","modelId":"test","hasKey":true}]);
    storage::write(&path, &value).unwrap();
    // An occupied temporary-file path deterministically simulates failed
    // metadata persistence without changing any filesystem permissions.
    let blocked_temp = path.with_extension("json.tmp");
    std::fs::create_dir(&blocked_temp).unwrap();
    let mut key_deleted = false;
    let result = storage::provider_credentials_clear_with(&path, &["one".into()], &[], |_| {
        key_deleted = true;
        Ok(())
    })
    .unwrap();
    assert!(key_deleted);
    assert_eq!(result["failures"][0]["errorKey"], "connectionDeleteFailed");
    assert_eq!(
        storage::read(&path, json!([])).unwrap(),
        value,
        "metadata must remain retriable on disk"
    );
    let inventory = storage::provider_credentials_inventory_with(&path, |_| Ok(false)).unwrap();
    assert_eq!(
        inventory["connections"][0]["hasKey"], false,
        "the UI must not claim the deleted key is still stored"
    );
    std::fs::remove_dir(blocked_temp).unwrap();
    let retried =
        storage::provider_credentials_clear_with(&path, &["one".into()], &[], |_| Ok(())).unwrap();
    assert!(retried["failures"].as_array().unwrap().is_empty());
    std::fs::remove_file(path).unwrap();
    std::fs::remove_dir(directory).unwrap();
}

#[test]
fn credential_clear_removes_legacy_before_connections_and_preserves_unconfirmed_items() {
    let path =
        std::env::temp_dir().join(format!("vibehub-clear-order-{}.json", std::process::id()));
    let connection = |id: &str| json!({"id":id,"name":id,"providerId":"openrouter","baseUrl":"https://openrouter.ai/api/v1","modelId":"test","hasKey":true});
    storage::write(
        &path,
        &json!([connection("chosen"), connection("unconfirmed")]),
    )
    .unwrap();
    let mut keys = std::collections::HashSet::from([
        "vibehub.provider-key.openrouter".to_owned(),
        "vibehub.provider-key.connection.chosen".to_owned(),
        "vibehub.provider-key.connection.unconfirmed".to_owned(),
    ]);
    let mut order = Vec::new();
    let result = storage::provider_credentials_clear_with(
        &path,
        &["chosen".into()],
        &["openrouter".into()],
        |service| {
            order.push(service.to_owned());
            keys.remove(service);
            Ok(())
        },
    )
    .unwrap();
    assert!(result["failures"].as_array().unwrap().is_empty());
    assert_eq!(
        order,
        vec![
            "vibehub.provider-key.openrouter",
            "vibehub.provider-key.connection.chosen"
        ]
    );
    assert_eq!(
        keys,
        std::collections::HashSet::from(["vibehub.provider-key.connection.unconfirmed".to_owned()])
    );
    assert_eq!(
        storage::read(&path, json!([])).unwrap()[0]["id"],
        "unconfirmed"
    );
    assert!(
        !keys.contains("vibehub.provider-key.openrouter"),
        "saving a new connection cannot rediscover the deleted legacy key"
    );
    std::fs::remove_file(path).unwrap();
}

#[test]
fn provider_connection_keys_are_bound_to_provider_and_origin() {
    let suffix = format!(
        "{}-{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    );
    let id = format!("scope-{suffix}");
    let path = std::env::temp_dir().join(format!("vibehub-provider-scope-{suffix}.json"));
    let service = format!("vibehub.provider-key.connection.{id}");
    let _ = std::fs::remove_file(&path);
    storage::vault_delete(&service).unwrap();

    let openai = json!({
        "id":id,"name":"OpenAI","providerId":"openai",
        "baseUrl":"https://api.openai.com/v1","modelId":"gpt-test","hasKey":false
    });
    let saved =
        storage::save_provider_connection(&path, openai.clone(), Some("secret-old-host")).unwrap();
    assert_eq!(saved[0]["hasKey"], true);
    assert_eq!(
        storage::vault_get(&service).unwrap().as_deref(),
        Some("secret-old-host")
    );

    let mut changed_origin = openai.clone();
    changed_origin["baseUrl"] = json!("https://gateway.example.test/v1");
    let saved = storage::save_provider_connection(&path, changed_origin, None).unwrap();
    assert_eq!(saved[0]["hasKey"], false);
    assert_eq!(
        storage::vault_get(&service).unwrap(),
        None,
        "changing endpoint origin must delete the old key"
    );

    storage::vault_set(&service, "secret-openai").unwrap();
    let ollama = json!({
        "id":id,"name":"Local Ollama","providerId":"ollama",
        "baseUrl":"http://127.0.0.1:11434/v1","modelId":"qwen-test","hasKey":true
    });
    let saved =
        storage::save_provider_connection(&path, ollama, Some("must-not-be-saved")).unwrap();
    assert_eq!(saved[0]["hasKey"], false);
    assert_eq!(
        storage::vault_get(&service).unwrap(),
        None,
        "Ollama must not retain a key"
    );
    assert_eq!(
        storage::provider_connections(&path).unwrap()[0]["hasKey"],
        false
    );

    storage::vault_delete(&service).unwrap();
    std::fs::remove_file(path).unwrap();
}

#[test]
fn ollama_connection_test_never_sends_a_stale_vault_key() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let id = format!(
        "ollama-test-{}-{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    );
    let service = format!("vibehub.provider-key.connection.{id}");
    storage::vault_set(&service, "stale-ollama-secret").unwrap();
    let server = std::thread::spawn(move || {
        use std::io::{Read, Write};
        let (mut stream, _) = listener.accept().unwrap();
        let mut request = [0; 4096];
        let size = stream.read(&mut request).unwrap();
        let request = String::from_utf8_lossy(&request[..size]).to_ascii_lowercase();
        assert!(!request.contains("authorization:"));
        assert!(!request.contains("stale-ollama-secret"));
        let body = r#"{"choices":[{"message":{"content":"OK"}}]}"#;
        write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
    });
    let connection = json!({
        "id":id,"name":"Local Ollama","providerId":"ollama",
        "baseUrl":format!("http://127.0.0.1:{port}/v1"),"modelId":"qwen-test","hasKey":true
    });
    let result = tauri::async_runtime::block_on(network::connection_test(
        connection,
        Some(json!({"id":"direct","name":"Direct","mode":"direct"})),
    ))
    .unwrap();
    assert_eq!(result["modelResponded"], true);
    assert_eq!(result["authValidated"], false);
    assert_eq!(result["authRequired"], false);
    assert!(!result.to_string().contains("stale-ollama-secret"));
    server.join().unwrap();
    storage::vault_delete(&service).unwrap();
}

#[test]
fn anthropic_connection_uses_its_native_headers_and_redacts_the_key() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let id = format!("anthropic-test-{}", std::process::id());
    let service = format!("vibehub.provider-key.connection.{id}");
    storage::vault_set(&service, "secret-test-key").unwrap();
    let server = std::thread::spawn(move || {
        use std::io::{Read, Write};
        let (mut stream, _) = listener.accept().unwrap();
        let mut request = [0; 4096];
        let size = stream.read(&mut request).unwrap();
        let request = String::from_utf8_lossy(&request[..size]).to_ascii_lowercase();
        assert!(request.contains("x-api-key: secret-test-key"));
        assert!(request.contains("anthropic-version: 2023-06-01"));
        let body = r#"{"content":[{"type":"text","text":"OK"}]}"#;
        write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
    });
    let connection = json!({
        "id":id,"name":"Test","providerId":"anthropic",
        "baseUrl":format!("http://127.0.0.1:{port}/v1"),"modelId":"claude-test","hasKey":true
    });
    let result = tauri::async_runtime::block_on(network::connection_test(
        connection,
        Some(json!({"id":"d","name":"direct","mode":"direct"})),
    ))
    .unwrap();
    assert_eq!(result["modelResponded"], true);
    assert!(!result.to_string().contains("secret-test-key"));
    server.join().unwrap();
    storage::vault_delete(&service).unwrap();
}

#[test]
fn google_connection_uses_api_key_header_instead_of_url_query() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let id = format!("google-test-{}", std::process::id());
    let service = format!("vibehub.provider-key.connection.{id}");
    storage::vault_set(&service, "secret-google-test").unwrap();
    let server = std::thread::spawn(move || {
        use std::io::{Read, Write};
        let (mut stream, _) = listener.accept().unwrap();
        let mut request = [0; 4096];
        let size = stream.read(&mut request).unwrap();
        let request = String::from_utf8_lossy(&request[..size]).to_ascii_lowercase();
        assert!(request.starts_with("post /v1beta/models/gemini-test:generatecontent http/1.1"));
        assert!(request.contains("x-goog-api-key: secret-google-test"));
        assert!(
            !request
                .lines()
                .next()
                .unwrap()
                .contains("secret-google-test")
        );
        let body = r#"{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}"#;
        write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
    });
    let connection = json!({
        "id":id,"name":"Google local test","providerId":"google",
        "baseUrl":format!("http://127.0.0.1:{port}/v1beta"),"modelId":"gemini-test"
    });
    let result = tauri::async_runtime::block_on(network::connection_test(
        connection,
        Some(json!({"id":"direct","name":"Direct","mode":"direct"})),
    ))
    .unwrap();
    assert_eq!(result["authValidated"], true);
    assert_eq!(result["modelResponded"], true);
    assert!(!result.to_string().contains("secret-google-test"));
    server.join().unwrap();
    storage::vault_delete(&service).unwrap();
}

#[test]
fn config_cannot_refer_to_deleted_profile_or_downgrade_required_proxy() {
    let profiles = vec![
        json!({"id":"p", "name":"test", "mode":"http", "host":"localhost", "port":1080}),
        json!({"id":"d", "name":"direct", "mode":"direct"}),
    ];
    assert!(
        validate_config(
            &json!({"globalProfileId":"p", "requireProxy":true, "perApp":{}}),
            &profiles
        )
        .is_ok()
    );
    assert!(
        validate_config(
            &json!({"globalProfileId":"missing", "requireProxy":false, "perApp":{}}),
            &profiles
        )
        .is_err()
    );
    assert!(
        validate_config(
            &json!({"globalProfileId":"d", "requireProxy":true, "perApp":{}}),
            &profiles
        )
        .is_err()
    );
}

#[test]
fn per_app_proxy_can_target_a_detected_editor() {
    let profiles =
        vec![json!({"id":"proxy","name":"local","mode":"socks5","host":"127.0.0.1","port":10808})];
    assert!(
        validate_config(
            &json!({"globalProfileId":"","requireProxy":false,"perApp":{"antigravity":"proxy"}}),
            &profiles
        )
        .is_ok()
    );
}

#[test]
fn network_urls_do_not_leak_credentials_or_allow_remote_cleartext() {
    assert!(safe_url("https://example.com/v1/").is_ok());
    assert!(safe_url("http://127.0.0.1:11434/v1").is_ok());
    for url in [
        "http://example.com",
        "https://user:secret@example.com",
        "file:///tmp/a",
        "https://example.com/#x",
    ] {
        assert!(safe_url(url).is_err());
    }
}

#[test]
fn feed_index_rejects_newer_clients_and_path_traversal() {
    let index = json!({"schemaVersion":1,"generatedAt":"2026-10-26","minClientVersion":"0.1.0","apps":["qoder"],"providers":[],"offers":[]});
    assert!(validate_index(&index).is_ok());
    let mut bad = index.clone();
    bad["apps"] = json!(["../payload"]);
    assert!(validate_index(&bad).is_err());
    let mut bad = index;
    bad["minClientVersion"] = json!("99.0.0");
    assert!(validate_index(&bad).is_err());
}

#[test]
fn installation_is_local_allowlist_only() {
    assert!(install_spec("qoder", "npm", Some("evil; calc")).is_err());
    assert!(install_spec("unknown", "winget", None).is_err());
    assert_eq!(
        install_spec("terminal", "winget", None).unwrap(),
        "JanDeDobbeleer.OhMyPosh"
    );
}

#[test]
fn settings_roundtrip_and_corruption_preserves_the_original_file() {
    let directory = std::env::temp_dir().join(format!(
        "vibehub-settings-{}-{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    ));
    let path = directory.join("تنظیمات.json");
    let state = storage::load(&path).unwrap();
    storage::write(&path, &state).unwrap();
    storage::write(&path, &state).unwrap();
    assert_eq!(storage::load(&path).unwrap(), state);
    std::fs::write(&path, b"broken").unwrap();
    assert!(storage::load(&path).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), b"broken");
    std::fs::remove_dir_all(directory).unwrap();
}

#[test]
#[cfg(windows)]
fn windows_vault_roundtrip_and_idempotent_delete() {
    let service = format!(
        "vibehub.test.{}.{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    );
    assert_eq!(storage::vault_get(&service).unwrap(), None);
    storage::vault_set(&service, "temporary-test-credential").unwrap();
    let key = storage::vault_get(&service).unwrap();
    storage::vault_delete(&service).unwrap();
    storage::vault_delete(&service).unwrap();
    assert_eq!(key.as_deref(), Some("temporary-test-credential"));
    assert_eq!(storage::vault_get(&service).unwrap(), None);
    assert!(storage::vault_set("other-app", "secret").is_err());
}

#[test]
fn tcp_success_does_not_count_as_socks_handshake_success() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = std::thread::spawn(move || {
        use std::io::{Read, Write};
        let (mut stream, _) = listener.accept().unwrap();
        let mut greeting = [0; 3];
        stream.read_exact(&mut greeting).unwrap();
        assert_eq!(greeting, [5, 1, 0]);
        stream.write_all(&[5, 255]).unwrap();
    });
    let profile =
        json!({"id":"test", "name":"test", "mode":"socks5", "host":"127.0.0.1", "port":port});
    let result =
        tauri::async_runtime::block_on(network::proxy_test(profile, "handshake".into())).unwrap();
    assert_eq!(result["ok"], false);
    server.join().unwrap();
}

#[test]
fn socks5_handshake_checks_username_password_authentication() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let id = format!(
        "socks-auth-{}-{}",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    );
    let service = format!("vibehub.proxy.{id}");
    storage::vault_set(&service, "pass-1").unwrap();
    let server = std::thread::spawn(move || {
        use std::io::{Read, Write};
        let (mut stream, _) = listener.accept().unwrap();
        let mut greeting = [0; 3];
        stream.read_exact(&mut greeting).unwrap();
        assert_eq!(greeting, [5, 1, 2]);
        stream.write_all(&[5, 2]).unwrap();
        let mut auth_header = [0; 2];
        stream.read_exact(&mut auth_header).unwrap();
        assert_eq!(auth_header[0], 1);
        let mut username = vec![0; auth_header[1] as usize];
        stream.read_exact(&mut username).unwrap();
        let mut password_len = [0; 1];
        stream.read_exact(&mut password_len).unwrap();
        let mut password = vec![0; password_len[0] as usize];
        stream.read_exact(&mut password).unwrap();
        assert_eq!(username, b"user");
        assert_eq!(password, b"pass-1");
        stream.write_all(&[1, 0]).unwrap();
    });
    let profile = json!({
        "id":id,"name":"authenticated test","mode":"socks5",
        "host":"127.0.0.1","port":port,"username":"user","hasPassword":true
    });
    let result =
        tauri::async_runtime::block_on(network::proxy_test(profile, "handshake".into())).unwrap();
    assert_eq!(result["ok"], true, "{}", result["detail"]);
    server.join().unwrap();
    storage::vault_delete(&service).unwrap();
}

#[test]
fn api_errors_are_redacted_and_do_not_validate_auth_or_model() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let server = std::thread::spawn(move || {
        use std::io::{Read, Write};
        let (mut stream, _) = listener.accept().unwrap();
        let mut bytes = [0; 4096];
        let _ = stream.read(&mut bytes).unwrap();
        let body = r#"{"error":"do-not-return-provider-secret"}"#;
        write!(stream, "HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
    });
    let provider = format!("test-{}", std::process::id());
    let result = tauri::async_runtime::block_on(network::api_test(
        Some(json!({"id":"d","name":"direct","mode":"direct"})),
        provider.clone(),
        format!("http://127.0.0.1:{port}/v1"),
        "model".into(),
        format!("vibehub.provider-key.{provider}"),
    ))
    .unwrap();
    assert_eq!(result["httpStatus"], 401);
    assert_eq!(result["httpResponse"], true);
    assert_eq!(result["authValidated"], false);
    assert_eq!(result["modelResponded"], false);
    assert!(!result.to_string().contains("do-not-return-provider-secret"));
    server.join().unwrap();
}

#[test]
fn feed_downloads_the_catalog_and_bilingual_guides_from_a_real_http_server() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    listener.set_nonblocking(true).unwrap();
    let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../content");
    let index: serde_json::Value = serde_json::from_slice(&std::fs::read(root.join("offers/index.json")).unwrap()).unwrap();
    let app_count = index["apps"].as_array().unwrap().len();
    let provider_count = index["providers"].as_array().unwrap().len();
    let request_count = 1 + app_count * 3 + provider_count + index["offers"].as_array().unwrap().len();
    let server = std::thread::spawn(move || {
        use std::io::{Read, Write};
        let start = std::time::Instant::now();
        let mut requests = 0;
        while requests < request_count && start.elapsed().as_secs() < 20 {
            let Ok((mut stream, _)) = listener.accept() else {
                std::thread::sleep(std::time::Duration::from_millis(5));
                continue;
            };
            stream.set_nonblocking(false).unwrap();
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(3)))
                .unwrap();
            let mut request = [0; 4096];
            let size = stream.read(&mut request).unwrap();
            let request = String::from_utf8_lossy(&request[..size]);
            let path = request
                .split_whitespace()
                .nth(1)
                .unwrap()
                .trim_start_matches('/');
            let file = if path == "index.json" {
                root.join("offers/index.json")
            } else {
                root.join(path)
            };
            let body = std::fs::read(file).unwrap();
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                body.len()
            )
            .unwrap();
            stream.write_all(&body).unwrap();
            requests += 1;
        }
        requests
    });
    let direct = Some(json!({"id":"direct","name":"Direct","mode":"direct"}));
    let result = tauri::async_runtime::block_on(network::feed_sync(
        direct,
        format!("http://127.0.0.1:{port}"),
    ))
    .unwrap();
    assert_eq!(result["catalog"]["apps"].as_array().unwrap().len(), app_count);
    assert_eq!(result["catalog"]["providers"].as_array().unwrap().len(), provider_count);
    assert_eq!(result["guides"].as_object().unwrap().len(), app_count * 2);
    assert!(
        result["guides"]["qoder/fa"]
            .as_str()
            .unwrap()
            .contains("Qoder")
    );
    assert_eq!(server.join().unwrap(), request_count);
}
