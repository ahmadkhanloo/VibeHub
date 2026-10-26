#[path = "../src/domain.rs"]
#[allow(dead_code)]
mod domain;
#[path = "../src/network.rs"]
#[allow(dead_code)]
mod network;
#[path = "../src/storage.rs"]
#[allow(dead_code)]
mod storage;

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
    let server = std::thread::spawn(move || {
        use std::io::{Read, Write};
        let start = std::time::Instant::now();
        let mut requests = 0;
        while requests < 23 && start.elapsed().as_secs() < 10 {
            let Ok((mut stream, _)) = listener.accept() else {
                std::thread::sleep(std::time::Duration::from_millis(5));
                continue;
            };
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
    assert_eq!(result["catalog"]["apps"].as_array().unwrap().len(), 6);
    assert_eq!(result["catalog"]["providers"].as_array().unwrap().len(), 4);
    assert_eq!(result["guides"].as_object().unwrap().len(), 12);
    assert!(
        result["guides"]["qoder/fa"]
            .as_str()
            .unwrap()
            .contains("Qoder")
    );
    assert_eq!(server.join().unwrap(), 23);
}
