#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|_app| {
            #[cfg(target_os = "windows")]
            {
                use tauri_plugin_window_state::StateFlags;

                _app.handle().plugin(
                    tauri_plugin_window_state::Builder::default()
                        .with_state_flags(
                            StateFlags::POSITION | StateFlags::SIZE | StateFlags::MAXIMIZED,
                        )
                        .build(),
                )?;
            }
            #[cfg(desktop)]
            _app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run n-mgram");
}
