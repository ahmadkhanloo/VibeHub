use crate::domain::{Result, install_spec};
use serde_json::{Value, json};
use std::{
    io::Write,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri::Manager;

// A launched desktop process can keep its parent's pipe handle open after the
// adapter exits. The structured result, rather than EOF, completes the request.
fn read_native_output(reader: impl std::io::Read) -> std::io::Result<String> {
    use std::io::BufRead;
    let mut output = String::new();
    for line in std::io::BufReader::new(reader).lines() {
        let line = line?;
        output.push_str(&line);
        output.push('\n');
        if line.starts_with("VIBEHUB_JSON:") {
            break;
        }
    }
    Ok(output)
}

#[cfg(test)]
mod native_output_tests {
    #[test]
    fn structured_result_completes_without_waiting_for_descendant_eof() {
        struct HeldPipe { sent: bool }
        impl std::io::Read for HeldPipe {
            fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
                assert!(!self.sent, "must not wait for EOF after the structured result");
                self.sent = true;
                let result = b"launcher ready\nVIBEHUB_JSON:{\"ok\":true}\n";
                buffer[..result.len()].copy_from_slice(result);
                Ok(result.len())
            }
        }
        assert_eq!(super::read_native_output(HeldPipe { sent: false }).unwrap(),
            "launcher ready\nVIBEHUB_JSON:{\"ok\":true}\n");
    }
}

pub fn resource_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf> {
    if cfg!(debug_assertions) {
        Ok(std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
    } else {
        app.path().resource_dir().map_err(|e| e.to_string())
    }
}

pub fn rtl_runtime_available(root: &std::path::Path) -> bool {
    [
        "runtime/node.exe",
        "apps/desktop/src-tauri/windows/payload/node.exe",
    ]
    .iter()
    .any(|relative| root.join(relative).is_file())
}

#[cfg(test)]
mod rtl_runtime_tests {
    use super::rtl_runtime_available;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn temp_root(label: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "vibehub-rtl-{label}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn detects_bundled_runtime_in_release_resources() {
        let root = temp_root("release");
        let executable = root.join("runtime/node.exe");
        fs::create_dir_all(executable.parent().unwrap()).unwrap();
        fs::write(&executable, b"test").unwrap();

        assert!(rtl_runtime_available(&root));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn detects_bundled_runtime_in_development_payload() {
        let root = temp_root("development");
        let executable = root.join("apps/desktop/src-tauri/windows/payload/node.exe");
        fs::create_dir_all(executable.parent().unwrap()).unwrap();
        fs::write(&executable, b"test").unwrap();

        assert!(rtl_runtime_available(&root));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_unavailable_when_no_bundled_runtime_exists() {
        let root = temp_root("missing");

        assert!(!rtl_runtime_available(&root));
        fs::remove_dir_all(root).unwrap();
    }
}

pub fn hidden(command: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    #[cfg(not(windows))]
    let _ = command;
}

pub fn powershell(app: &tauri::AppHandle, mut request: Value) -> Result<Value> {
    if !cfg!(windows) {
        return Err("This adapter requires Windows".into());
    }
    let timeout = match request["operation"].as_str() {
        Some("detect" | "detect-editors") => Duration::from_secs(15),
        Some("launch-state" | "launch-states") => Duration::from_secs(15),
        Some("account-app-state" | "account-app-open") => Duration::from_secs(10),
        Some("account-app-close") => Duration::from_secs(20),
        _ => Duration::from_secs(150),
    };
    request["resourceRoot"] = json!(resource_root(app)?);
    let data = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;
    let script = data.join(format!(
        "native-{}-{}.ps1",
        std::process::id(),
        chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default()
    ));
    std::fs::write(&script, include_str!("windows.ps1")).map_err(|e| e.to_string())?;
    let result = (|| {
        let mut command = Command::new("powershell.exe");
        command
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&script)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        hidden(&mut command);
        let mut child = command
            .spawn()
            .map_err(|_| "Could not start Windows PowerShell")?;
        child
            .stdin
            .take()
            .ok_or("Missing native input")?
            .write_all(
                serde_json::to_string(&request)
                    .map_err(|e| e.to_string())?
                    .as_bytes(),
            )
            .map_err(|_| "Could not send native request")?;
        // Drain pipes concurrently: installer or launcher output cannot fill a pipe and deadlock.
        use std::io::Read;
        let stdout = child.stdout.take().ok_or("Missing native output")?;
        let mut stderr = child.stderr.take().ok_or("Missing native error output")?;
        let (output_sender, output_receiver) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let output = read_native_output(stdout).unwrap_or_default();
            let _ = output_sender.send(output);
        });
        std::thread::spawn(move || {
            let mut output = Vec::new();
            let _ = stderr.read_to_end(&mut output);
        });
        let start = Instant::now();
        loop {
            if child
                .try_wait()
                .map_err(|_| "Could not inspect native process")?
                .is_some()
            {
                break;
            }
            if start.elapsed() > timeout {
                let _ = child.kill();
                let _ = child.wait();
                return Err(
                    "Native operation timed out; inspect the current state before retrying".into(),
                );
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        // Descendants may inherit pipe handles: never join an unbounded pipe reader.
        let output = output_receiver
            .recv_timeout(timeout.saturating_sub(start.elapsed()))
            .map_err(|_| "Native output timed out; inspect the current state before retrying")?;
        let json = output
            .lines()
            .rev()
            .find_map(|line| line.strip_prefix("VIBEHUB_JSON:"))
            .ok_or("Native adapter returned no structured result")?;
        let value: Value =
            serde_json::from_str(json).map_err(|_| "Native adapter returned invalid JSON")?;
        if let Some(error) = value.get("error").and_then(Value::as_str) {
            return Err(error.to_owned());
        }
        Ok(value)
    })();
    let _ = std::fs::remove_file(script);
    result
}

pub async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| "Background operation failed")?
}

pub async fn run(app: tauri::AppHandle, request: Value) -> Result<Value> {
    tauri::async_runtime::spawn_blocking(move || powershell(&app, request))
        .await
        .map_err(|_| "Native operation task failed")?
}

pub async fn install(
    app: tauri::AppHandle,
    id: String,
    method: &'static str,
    package: Option<String>,
) -> Result<Value> {
    let spec = install_spec(&id, method, package.as_deref())?.to_owned();
    tauri::async_runtime::spawn_blocking(move || {
        let mut command = Command::new("winget.exe");
        command.args(["install", "--id", &spec, "--exact", "--source", "winget", "--accept-source-agreements", "--accept-package-agreements", "--disable-interactivity"]);
        hidden(&mut command);
        let output = command.output().map_err(|_| "winget is unavailable; use the official guide")?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let tail: Vec<_> = stdout.lines().rev().take(15).collect::<Vec<_>>().into_iter().rev().collect();
        let detected = if id == "terminal" { Value::Null } else { powershell(&app, json!({"operation":"detect"}))?.as_array().and_then(|a| a.iter().find(|v| v["id"] == id)).cloned().unwrap_or(Value::Null) };
        Ok(json!({"ok":output.status.success(),"method":method,"outputTail":tail,"detected":detected}))
    }).await.map_err(|_| "Installer task failed")?
}
