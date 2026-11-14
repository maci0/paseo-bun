#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    io::{BufRead, BufReader},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

fn stop_host(child: &Arc<Mutex<Option<Child>>>) {
    if let Some(mut process) = child.lock().expect("UI host lock").take() {
        let _ = process.kill();
        let _ = process.wait();
    }
}

fn main() {
    if std::env::args().any(|arg| arg == "--version") {
        println!("Paseo Bun Desktop {}", env!("CARGO_PKG_VERSION"));
        return;
    }
    let child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let setup_child = child.clone();
    let exit_child = child.clone();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(move |app| {
            let executable = std::env::current_exe()?;
            let engine_directory = executable
                .parent()
                .ok_or("Missing installation directory")?;
            #[cfg(target_os = "macos")]
            let engine_directory = engine_directory.join("../Resources/runtime");
            let engine =
                engine_directory.join(format!("paseo-bun{}", std::env::consts::EXE_SUFFIX));
            let mut command = Command::new(engine);
            command
                .arg("ui-host")
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit());
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            #[cfg(target_os = "linux")]
            {
                use std::os::unix::process::CommandExt;
                let parent = std::process::id() as libc::pid_t;
                // An abruptly terminated window must not leave its UI host running.
                unsafe {
                    command.pre_exec(move || {
                        if libc::prctl(libc::PR_SET_PDEATHSIG, libc::SIGTERM) != 0 {
                            return Err(std::io::Error::last_os_error());
                        }
                        if libc::getppid() != parent {
                            return Err(std::io::Error::other("Desktop parent exited"));
                        }
                        Ok(())
                    });
                }
            }
            let mut process = command.spawn()?;
            let output = process.stdout.take().ok_or("Missing UI host output")?;
            *setup_child.lock().expect("UI host lock") = Some(process);
            let (sender, receiver) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                for line in BufReader::new(output).lines().map_while(Result::ok) {
                    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&line) {
                        if value["type"] == "paseo-ui-ready" {
                            if let Some(url) = value["url"].as_str() {
                                let _ = sender.send(url.to_owned());
                            }
                        }
                    }
                }
            });
            let address = receiver.recv_timeout(Duration::from_secs(40))?;
            let url: tauri::Url = address.parse()?;
            if url.scheme() != "http" || url.host_str() != Some("127.0.0.1") {
                return Err("UI host returned an invalid local address".into());
            }
            let allowed_origin = url.origin();
            let opener = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Paseo Bun — AOT + Elysia + Tauri v2")
                .inner_size(1280.0, 860.0)
                .min_inner_size(900.0, 600.0)
                .on_navigation(move |target| {
                    if target.origin() == allowed_origin {
                        return true;
                    }
                    if matches!(target.scheme(), "https" | "http") {
                        let _ = opener.opener().open_url(target.as_str(), None::<String>);
                    }
                    false
                })
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!());
    match app {
        Ok(app) => app.run(move |_, event| {
            if matches!(event, RunEvent::Exit) {
                stop_host(&exit_child);
            }
        }),
        Err(error) => {
            stop_host(&child);
            eprintln!("Paseo desktop startup failed: {error}");
            std::process::exit(1);
        }
    }
}
