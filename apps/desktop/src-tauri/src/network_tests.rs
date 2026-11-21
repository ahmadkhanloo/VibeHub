use super::*;
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    thread,
};

const KEY: &str = "synthetic-test-key-not-a-real-credential";
fn profile(mode: &str, port: u16) -> Value {
    json!({"id":"network-fixture", "name":"Fixture", "mode":mode, "host":"127.0.0.1", "port":port})
}
fn connection(provider: &str, port: u16) -> Value {
    json!({"id":"network-fixture", "name":"Fixture", "providerId":provider,
        "baseUrl":format!("http://127.0.0.1:{port}/v1/"), "modelId":"fixture-model"})
}
fn listener() -> TcpListener {
    TcpListener::bind("127.0.0.1:0").unwrap()
}
fn request(stream: &mut TcpStream) -> String {
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let mut data = Vec::new();
    loop {
        let mut byte = [0];
        stream.read_exact(&mut byte).unwrap();
        data.push(byte[0]);
        if data.ends_with(b"\r\n\r\n") {
            break;
        }
        assert!(data.len() < 16384);
    }
    let headers = String::from_utf8(data.clone()).unwrap();
    let length = headers
        .lines()
        .find_map(|line| {
            line.to_ascii_lowercase()
                .strip_prefix("content-length:")
                .map(|s| s.trim().parse::<usize>().unwrap())
        })
        .unwrap_or(0);
    let mut body = vec![0; length];
    stream.read_exact(&mut body).unwrap();
    data.extend(body);
    String::from_utf8(data).unwrap()
}
fn response(stream: &mut TcpStream, status: u16, body: &str, extra: &str) {
    let text = format!(
        "HTTP/1.1 {status} Fixture\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n{extra}\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(text.as_bytes());
}
fn http_server(status: u16, body: String, extra: String) -> (u16, thread::JoinHandle<String>) {
    let server = listener();
    let port = server.local_addr().unwrap().port();
    let handle = thread::spawn(move || {
        let (mut stream, _) = server.accept().unwrap();
        let text = request(&mut stream);
        response(&mut stream, status, &body, &extra);
        text
    });
    (port, handle)
}
fn direct() -> reqwest::Client {
    client_with_password(
        Some(&json!({"id":"direct", "name":"Direct", "mode":"direct"})),
        None,
    )
    .unwrap()
}
fn run_api(provider: &str, status: u16, body: &str) -> (Value, String) {
    let (port, server) = http_server(status, body.to_owned(), String::new());
    let report = tauri::async_runtime::block_on(connection_test_with_client(
        connection(provider, port),
        direct(),
        Some(KEY.into()),
    ))
    .unwrap();
    (report, server.join().unwrap())
}

#[test]
fn http_connect_handles_fragmented_status_and_authentication() {
    let server = listener();
    let port = server.local_addr().unwrap().port();
    let worker = thread::spawn(move || {
        let (mut stream, _) = server.accept().unwrap();
        let text = request(&mut stream);
        assert!(text.starts_with("CONNECT example.com:443 HTTP/1.1"));
        let expected = BASE64_STANDARD.encode(format!("fixture:{KEY}"));
        assert!(text.contains(&format!("Proxy-Authorization: Basic {expected}")));
        stream.write_all(b"HTTP/1.1 ").unwrap();
        thread::sleep(Duration::from_millis(40));
        stream
            .write_all(b"200 Connection established\r\n\r\n")
            .unwrap();
    });
    let mut p = profile("http", port);
    p["username"] = json!("fixture");
    assert!(handshake_with_password(&p, Some(KEY)).is_ok());
    worker.join().unwrap();
    let (port, worker) = http_server(407, "denied".into(), String::new());
    assert!(handshake_with_password(&profile("http", port), None).is_err());
    worker.join().unwrap();
}

fn socks_auth(stream: &mut TcpStream, authenticated: bool, accept: bool) {
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .unwrap();
    let mut greeting = [0; 3];
    stream.read_exact(&mut greeting).unwrap();
    assert_eq!(greeting, [5, 1, if authenticated { 2 } else { 0 }]);
    stream
        .write_all(&[5, if authenticated { 2 } else { 0 }])
        .unwrap();
    if authenticated {
        let mut head = [0; 2];
        stream.read_exact(&mut head).unwrap();
        assert_eq!(head[0], 1);
        let mut username = vec![0; head[1] as usize];
        stream.read_exact(&mut username).unwrap();
        let mut length = [0];
        stream.read_exact(&mut length).unwrap();
        let mut password = vec![0; length[0] as usize];
        stream.read_exact(&mut password).unwrap();
        assert_eq!(username, b"fixture");
        assert_eq!(password, KEY.as_bytes());
        stream.write_all(&[1, if accept { 0 } else { 1 }]).unwrap();
    }
}

#[test]
fn socks_handshake_authenticates_and_rejects_wrong_credentials() {
    for (authenticated, accept) in [(false, true), (true, true), (true, false)] {
        let server = listener();
        let port = server.local_addr().unwrap().port();
        let worker = thread::spawn(move || {
            let (mut stream, _) = server.accept().unwrap();
            socks_auth(&mut stream, authenticated, accept);
        });
        let mut p = profile("socks5", port);
        if authenticated {
            p["username"] = json!("fixture");
            p["hasPassword"] = json!(true);
        }
        let result = handshake_with_password(&p, if authenticated { Some(KEY) } else { None });
        assert_eq!(result.is_ok(), accept);
        worker.join().unwrap();
    }
}

#[test]
fn http_proxy_carries_a_real_api_request_and_proxy_credentials() {
    let (port, server) = http_server(
        200,
        r#"{"choices":[{"message":{"content":"OK"}}]}"#.into(),
        String::new(),
    );
    let mut p = profile("http", port);
    p["username"] = json!("fixture");
    p["hasPassword"] = json!(true);
    let http = client_with_password(Some(&p), Some(KEY)).unwrap();
    // Port 1 has no API server: success proves the explicit proxy carried the request.
    let report = tauri::async_runtime::block_on(connection_test_with_client(
        connection("openai", 1),
        http,
        Some(KEY.into()),
    ))
    .unwrap();
    assert_eq!(report["modelResponded"], true);
    let sent = server.join().unwrap().to_lowercase();
    assert!(sent.starts_with("post http://127.0.0.1:1/v1/chat/completions http/1.1"));
    assert!(sent.contains("proxy-authorization: basic "));

    // HTTPS must authenticate the CONNECT tunnel too, before any TLS/request body.
    let (port, server) = http_server(407, "{}".into(), String::new());
    p["port"] = json!(port);
    let http = client_with_password(Some(&p), Some(KEY)).unwrap();
    assert!(
        tauri::async_runtime::block_on(async {
            http.get("https://api.example.invalid/probe").send().await
        })
        .is_err()
    );
    let sent = server.join().unwrap().to_lowercase();
    assert!(sent.starts_with("connect api.example.invalid:443 http/1.1"));
    assert!(sent.contains("proxy-authorization: basic "));
}

#[test]
fn socks_client_routes_requests_with_remote_dns_and_authentication() {
    for authenticated in [false, true] {
        let server = listener();
        let port = server.local_addr().unwrap().port();
        let worker = thread::spawn(move || {
            let (mut stream, _) = server.accept().unwrap();
            socks_auth(&mut stream, authenticated, true);
            let mut head = [0; 5];
            stream.read_exact(&mut head).unwrap();
            assert_eq!(&head[..4], &[5, 1, 0, 3]);
            let mut destination = vec![0; head[4] as usize + 2];
            stream.read_exact(&mut destination).unwrap();
            assert_eq!(
                &destination[..destination.len() - 2],
                b"api.example.invalid"
            );
            stream
                .write_all(&[5, 0, 0, 1, 127, 0, 0, 1, 0, 80])
                .unwrap();
            let sent = request(&mut stream);
            assert!(sent.starts_with("GET /probe HTTP/1.1"));
            assert!(!sent.to_lowercase().contains("proxy-authorization"));
            response(&mut stream, 200, r#"{"ok":true}"#, "");
        });
        let mut p = profile("socks5", port);
        if authenticated {
            p["username"] = json!("fixture");
            p["hasPassword"] = json!(true);
        }
        let http =
            client_with_password(Some(&p), if authenticated { Some(KEY) } else { None }).unwrap();
        let status = tauri::async_runtime::block_on(async {
            http.get("http://api.example.invalid/probe")
                .send()
                .await
                .unwrap()
                .status()
        });
        assert_eq!(status, 200);
        worker.join().unwrap();
    }
}

#[test]
fn explicit_failed_proxy_never_falls_back_to_direct() {
    let target = listener();
    target.set_nonblocking(true).unwrap();
    let target_port = target.local_addr().unwrap().port();
    let unused = listener();
    let proxy_port = unused.local_addr().unwrap().port();
    drop(unused);
    let http = client_with_password(Some(&profile("http", proxy_port)), None).unwrap();
    assert!(
        tauri::async_runtime::block_on(async {
            http.get(format!("http://127.0.0.1:{target_port}/"))
                .send()
                .await
        })
        .is_err()
    );
    assert_eq!(
        target.accept().unwrap_err().kind(),
        std::io::ErrorKind::WouldBlock
    );
    let mut p = profile("http", proxy_port);
    p["hasPassword"] = json!(true);
    assert!(client_with_password(Some(&p), None).is_err());
}

#[test]
fn provider_protocols_send_the_correct_headers_paths_and_bodies() {
    for (provider, body, path, header) in [
        (
            "openai",
            r#"{"choices":[{"message":{"content":"OK"}}]}"#,
            "/v1/chat/completions",
            "authorization: bearer ",
        ),
        (
            "anthropic",
            r#"{"content":[{"type":"text","text":"OK"}]}"#,
            "/v1/messages",
            "x-api-key: ",
        ),
        (
            "google",
            r#"{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}"#,
            "/v1/models/fixture-model:generateContent",
            "x-goog-api-key: ",
        ),
    ] {
        let (report, sent) = run_api(provider, 200, body);
        assert_eq!(report["modelResponded"], true);
        assert_eq!(report["authValidated"], true);
        assert!(sent.starts_with(&format!("POST {path} HTTP/1.1")));
        assert!(sent.to_lowercase().contains(&format!("{header}{KEY}")));
        let payload: Value = serde_json::from_str(sent.split("\r\n\r\n").nth(1).unwrap()).unwrap();
        if provider == "google" {
            assert_eq!(payload["contents"][0]["parts"][0]["text"], "Reply with OK.");
        } else {
            assert_eq!(payload["model"], "fixture-model");
        }
        if provider == "anthropic" {
            assert!(sent.contains("anthropic-version: 2023-06-01"));
        }
        assert!(!report.to_string().contains(KEY));
    }
}

#[test]
fn failed_or_invalid_api_responses_never_claim_authentication_or_leak_secrets() {
    for (status, body) in [
        (401, format!(r#"{{"error":"{KEY}"}}"#)),
        (429, "{}".into()),
        (500, "{}".into()),
        (200, "not json".into()),
        (200, r#"{"choices":[{"message":{"content":""}}]}"#.into()),
        (200, "x".repeat(1024 * 1024 + 1)),
    ] {
        let (report, _) = run_api("openai", status, &body);
        assert_eq!(report["httpResponse"], true);
        assert_eq!(report["httpStatus"], status);
        assert_eq!(report["modelResponded"], false);
        assert_eq!(report["authValidated"], false);
        assert!(!report.to_string().contains(KEY));
    }
}

#[test]
fn missing_api_key_does_not_send_a_request() {
    let target = listener();
    let port = target.local_addr().unwrap().port();
    target.set_nonblocking(true).unwrap();
    let report = tauri::async_runtime::block_on(connection_test_with_client(
        connection("openai", port),
        direct(),
        None,
    ))
    .unwrap();
    assert_eq!(report["httpResponse"], false);
    assert_eq!(
        target.accept().unwrap_err().kind(),
        std::io::ErrorKind::WouldBlock
    );
}

#[test]
fn ollama_uses_no_key_and_reports_authentication_as_not_required() {
    let (port, server) = http_server(
        200,
        r#"{"choices":[{"message":{"content":"OK"}}]}"#.into(),
        String::new(),
    );
    let report = tauri::async_runtime::block_on(connection_test_with_client(
        connection("ollama", port),
        direct(),
        None,
    ))
    .unwrap();
    assert_eq!(report["modelResponded"], true);
    assert_eq!(report["authRequired"], false);
    assert_eq!(report["authValidated"], false);
    assert!(
        !server
            .join()
            .unwrap()
            .to_lowercase()
            .contains("authorization:")
    );
}

#[test]
fn redirects_are_not_followed_with_api_keys() {
    let target = listener();
    target.set_nonblocking(true).unwrap();
    let (port, server) = http_server(
        307,
        "{}".into(),
        format!(
            "Location: http://127.0.0.1:{}/leak\r\n",
            target.local_addr().unwrap().port()
        ),
    );
    let report = tauri::async_runtime::block_on(connection_test_with_client(
        connection("openai", port),
        direct(),
        Some(KEY.into()),
    ))
    .unwrap();
    assert_eq!(report["httpStatus"], 307);
    assert_eq!(report["modelResponded"], false);
    assert_eq!(
        target.accept().unwrap_err().kind(),
        std::io::ErrorKind::WouldBlock
    );
    server.join().unwrap();
}

#[test]
#[ignore = "Opt-in real network checks; no credentials or configuration are changed"]
fn live_network_routes() {
    let port = std::env::var("VIBEHUB_LIVE_PROXY_PORT")
        .unwrap()
        .parse::<u16>()
        .unwrap();
    let mut reports = Vec::new();
    for mode in ["direct", "system", "http", "socks5"] {
        for level in if matches!(mode, "http" | "socks5") {
            vec!["tcp", "handshake", "request"]
        } else {
            vec!["request"]
        } {
            let report =
                tauri::async_runtime::block_on(proxy_test(profile(mode, port), level.into()));
            let report = match report {
                Ok(value) => value,
                Err(_) => json!({"ok":false,"detail":"Test setup failed"}),
            };
            println!("LIVE {} {} ok={}", mode, level, report["ok"]);
            reports.push(json!({"mode":mode,"level":level,"report":report}));
        }
    }
    let path = std::env::var("VIBEHUB_NETWORK_REPORT").unwrap();
    std::fs::write(path, serde_json::to_vec_pretty(&reports).unwrap()).unwrap();
}

#[test]
fn free_status_requires_supported_provider_evidence() {
    assert_eq!(super::model_free_status("openrouter", "vendor/model:free", &serde_json::json!({})), Some(true));
    assert_eq!(super::model_free_status("radeon-cloud", "model", &serde_json::json!({"free": true})), Some(true));
    assert_eq!(super::model_free_status("custom", "model-free", &serde_json::json!({"free": true})), None);
}

#[test]
fn feed_downloads_learning_and_only_treats_404_as_an_older_feed() {
    for (status, body) in [(200, "[]"), (404, "{}"), (500, "{}"), (200, "broken json")] {
        let server = listener();
        let port = server.local_addr().unwrap().port();
        // Non-404 errors and malformed legacy JSON stop before the new optional endpoints.
        let request_count = if status == 500 || body == "broken json" { 4 } else { 6 };
        let handle = thread::spawn(move || {
            // Empty catalog plus optional legacy learning, articles and news.
            for _ in 0..request_count {
                let (mut stream, _) = server.accept().unwrap();
                let text = request(&mut stream);
                let path = text.split_whitespace().nth(1).unwrap();
                match path {
                    "/feed/index.json" => response(&mut stream, 200,
                        r#"{"schemaVersion":1,"generatedAt":"2026-11-01","apps":[],"providers":[],"offers":[]}"#, ""),
                    "/feed/learning/extensions.json" => response(&mut stream, status, body, ""),
                    "/feed/learning/index.json" | "/feed/news/index.json" => response(&mut stream, 404, "{}", ""),
                    "/feed/guides/code-review/fa.md" | "/feed/guides/code-review/en.md" => response(&mut stream, 404, "{}", ""),
                    _ => panic!("Unexpected feed request: {path}"),
                }
            }
        });
        let result = tauri::async_runtime::block_on(feed_sync(
            Some(json!({"id":"direct","name":"Direct","mode":"direct"})),
            format!("http://127.0.0.1:{port}/feed"),
        ));
        handle.join().unwrap();
        match (status, body) {
            (200, "[]") => assert_eq!(result.unwrap()["learning"], json!([])),
            (404, _) => assert!(result.unwrap().get("learning").is_none()),
            _ => assert!(result.is_err()),
        }
    }
}

#[test]
fn feed_downloads_optional_dynamic_learning_and_news_without_a_client_update() {
    let server = listener();
    let port = server.local_addr().unwrap().port();
    let handle = thread::spawn(move || {
        for _ in 0..6 {
            let (mut stream, _) = server.accept().unwrap();
            let path = request(&mut stream).split_whitespace().nth(1).unwrap().to_owned();
            match path.as_str() {
                "/feed/index.json" => response(&mut stream, 200,
                    r#"{"schemaVersion":1,"generatedAt":"2026-11-02","apps":[],"providers":[],"offers":[]}"#, ""),
                "/feed/guides/code-review/fa.md" | "/feed/guides/code-review/en.md" | "/feed/learning/extensions.json" => response(&mut stream, 404, "{}", ""),
                "/feed/learning/index.json" => response(&mut stream, 200,
                    r#"{"schemaVersion":1,"categories":[],"articles":[]}"#, ""),
                "/feed/news/index.json" => response(&mut stream, 200,
                    r#"{"schemaVersion":1,"news":[]}"#, ""),
                _ => panic!("Unexpected feed request: {path}"),
            }
        }
    });
    let result = tauri::async_runtime::block_on(feed_sync(
        Some(json!({"id":"direct","name":"Direct","mode":"direct"})),
        format!("http://127.0.0.1:{port}/feed"),
    )).unwrap();
    handle.join().unwrap();
    assert_eq!(result["learningArticles"]["categories"], json!([]));
    assert_eq!(result["news"]["news"], json!([]));
}


#[test]
fn model_discovery_classifies_returned_models_and_redacts_errors() {
    let payload = json!({"data":[
        {"id":"route:free"},
        {"id":"paid","pricing":{"prompt":"0.0001","completion":"0"}},
        {"id":"zero","pricing":{"prompt":"0","completion":0,"request":"0"}},
        {"id":"partial","pricing":{"prompt":"0"}},
        {"id":"conflict:free","pricing":{"prompt":"1","completion":"0"}},
        {"id":"malformed","pricing":{"prompt":"0","completion":"NaN"}},
        {"id":KEY}
    ]});
    let (port, server) = http_server(200, payload.to_string(), String::new());
    let result = tauri::async_runtime::block_on(connection_models(
        "openrouter", &format!("http://127.0.0.1:{port}/v1/"), direct(), Some(KEY)
    )).unwrap();
    let captured = server.join().unwrap();
    assert!(captured.starts_with("GET /v1/models HTTP/1.1"));
    assert!(captured.contains(&format!("authorization: Bearer {KEY}")));
    assert_eq!(result["models"], json!([
        {"id":"route:free","free":true},
        {"id":"paid","free":false},
        {"id":"zero","free":true},
        {"id":"partial","free":null},
        {"id":"conflict:free","free":null},
        {"id":"malformed","free":null}
    ]));
    assert_eq!(model_free_status("radeon-cloud", "fixture", &json!({"free":false})), Some(false));
    assert_eq!(model_free_status("custom", "unverified-free", &json!({})), None);

    for (status, body, expected) in [
        (401, KEY, "HTTP 401"),
        (302, KEY, "HTTP 302"),
        (200, "{}", "supported model list"),
    ] {
        let (port, server) = http_server(status, body.into(), "Location: http://127.0.0.1:1/\r\n".into());
        let error = tauri::async_runtime::block_on(connection_models(
            "custom", &format!("http://127.0.0.1:{port}/v1"), direct(), Some(KEY)
        )).unwrap_err();
        server.join().unwrap();
        assert!(error.contains(expected));
        assert!(!error.contains(KEY));
    }
}

#[test]
fn native_model_catalogs_paginate_on_the_same_endpoint() {
    for (provider, header, first, second, next_path, expected) in [
        ("anthropic", "x-api-key", json!({"data":[{"id":"first"}],"has_more":true,"last_id":"cursor/1"}), json!({"data":[{"id":"second"}],"has_more":false}), "after_id=cursor%2F1", "second"),
        ("google", "x-goog-api-key", json!({"models":[{"name":"models/first"}],"nextPageToken":"cursor/1"}), json!({"models":[{"name":"models/second"}]}), "pageToken=cursor%2F1", "second"),
    ] {
        let fixture = listener();
        let port = fixture.local_addr().unwrap().port();
        let server = thread::spawn(move || {
            for (query, body) in [("".to_owned(), first), (format!("?{next_path}"), second)] {
                let (mut stream, _) = fixture.accept().unwrap();
                let captured = request(&mut stream);
                assert!(captured.starts_with(&format!("GET /v1/models{query} HTTP/1.1")));
                assert!(captured.contains(&format!("{header}: {KEY}")));
                response(&mut stream, 200, &body.to_string(), "");
            }
        });
        let result = tauri::async_runtime::block_on(connection_models(
            provider, &format!("http://127.0.0.1:{port}/v1"), direct(), Some(KEY)
        )).unwrap();
        server.join().unwrap();
        assert_eq!(result["models"][0]["id"], "first");
        assert_eq!(result["models"][1]["id"], expected);
    }
}

#[test]
fn a_saved_connection_can_list_models_without_an_inference_model() {
    let (port, server) = http_server(200, r#"{"data":[]}"#.into(), String::new());
    let mut saved = connection("ollama", port);
    saved["modelId"] = json!("");
    crate::domain::validate_provider_connection(&saved).unwrap();
    assert!(tauri::async_runtime::block_on(connection_test_with_client(
        saved.clone(), direct(), None,
    )).unwrap_err().contains("Choose a model"));
    let result = tauri::async_runtime::block_on(connection_models(
        "ollama", saved["baseUrl"].as_str().unwrap(), direct(), Some(KEY)
    )).unwrap();
    assert_eq!(result["models"], json!([]));
    assert!(!server.join().unwrap().contains(KEY));
}

#[test]
fn custom_endpoint_can_list_and_test_without_credentials() {
    let (port, server) = http_server(200, r#"{"data":[{"id":"fixture"}]}"#.into(), String::new());
    let result = tauri::async_runtime::block_on(connection_models(
        "custom", &format!("http://127.0.0.1:{port}/v1"), direct(), None
    )).unwrap();
    assert_eq!(result["models"][0]["id"], "fixture");
    assert!(!server.join().unwrap().to_lowercase().contains("authorization:"));

    let (port, server) = http_server(401, "{}".into(), String::new());
    let report = tauri::async_runtime::block_on(connection_test_with_client(
        connection("custom", port), direct(), None
    )).unwrap();
    assert_eq!(report["authValidated"], false);
    assert_eq!(report["modelResponded"], false);
    assert_eq!(report["httpStatus"], 401);
    assert!(!server.join().unwrap().to_lowercase().contains("authorization:"));
}

#[test]
#[ignore = "Explicit live acceptance: uses selected provider credentials and quota"]
fn live_selected_saved_providers() {
    let root = std::path::PathBuf::from(std::env::var_os("APPDATA").expect("APPDATA required")).join("com.ahmadkhanloo.vibehub");
    let connections = crate::storage::provider_connections(&root.join("provider-connections.json")).expect("Read connections");
    let (profile, _) = crate::storage::selected_profile(&root.join("proxy.json"), "*", None).expect("Read proxy");
    for provider in ["nvidia-build", "apinex", "openrouter"] {
        let Some(connection) = connections.as_array().unwrap().iter().find(|c| c["providerId"] == provider && c["hasKey"] == true) else { println!("LIVE_RESULT {} missing saved credential", provider); continue; };
        let id = connection["id"].as_str().unwrap();
        let key = crate::storage::vault_get(&format!("vibehub.provider-key.connection.{id}")).expect("Read credential");
        let http = client(profile.as_ref()).expect("Configured proxy");
        let models = tauri::async_runtime::block_on(connection_models(provider, connection["baseUrl"].as_str().unwrap_or(""), http, key.as_deref()));
        let mut result = json!({"provider":provider, "modelsOk":models.is_ok()});
        match models { Ok(list) => result["modelCount"] = json!(list["models"].as_array().map_or(0, |v| v.len())), Err(error) => result["modelsError"] = json!(error) }
        if !connection["modelId"].as_str().unwrap_or("").trim().is_empty() {
            match tauri::async_runtime::block_on(connection_test(connection.clone(), profile.clone())) {
                Ok(report) => { result["httpStatus"] = report["httpStatus"].clone(); result["modelResponded"] = report["modelResponded"].clone(); result["authValidated"] = report["authValidated"].clone(); },
                Err(_) => result["testError"] = json!("Could not test connection"),
            }
        } else { result["testError"] = json!("No model selected"); }
        println!("LIVE_RESULT {}", result);
    }
}

#[test]
#[ignore = "Explicit live acceptance: one inference per selected provider"]
fn live_selected_provider_inference() {
    let root = std::path::PathBuf::from(std::env::var_os("APPDATA").expect("APPDATA required")).join("com.ahmadkhanloo.vibehub");
    let connections = crate::storage::provider_connections(&root.join("provider-connections.json")).expect("Read connections");
    let (profile, _) = crate::storage::selected_profile(&root.join("proxy.json"), "*", None).expect("Read proxy");
    for (provider, model) in [("nvidia-build", "meta/llama-3.3-70b-instruct"), ("apinex", "free/jev-1.13"), ("openrouter", "openai/gpt-oss-20b:free")] {
        let Some(mut connection) = connections.as_array().unwrap().iter().find(|c| c["providerId"] == provider && c["hasKey"] == true).cloned() else { println!("LIVE_INFERENCE {} unavailable", provider); continue; };
        connection["modelId"] = json!(model);
        match tauri::async_runtime::block_on(connection_test(connection, profile.clone())) {
            Ok(report) => println!("LIVE_INFERENCE {}", json!({"provider":provider,"model":model,"httpStatus":report["httpStatus"],"modelResponded":report["modelResponded"],"authValidated":report["authValidated"],"httpResponse":report["httpResponse"]})),
            Err(_) => println!("LIVE_INFERENCE {}", json!({"provider":provider,"model":model,"error":"Could not test connection"})),
        }
    }
}
