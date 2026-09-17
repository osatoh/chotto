use std::sync::Mutex;

use tauri::{Manager, State, WindowEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Pin state. While true the window stays visible even when it loses focus.
#[derive(Default)]
struct Pinned(Mutex<bool>);

/// Whether the window has held focus since it was last shown.
#[derive(Default)]
struct WasFocused(Mutex<bool>);

#[tauri::command]
fn set_pinned(pinned: bool, state: State<'_, Pinned>, window: tauri::Window) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = pinned;
    window.set_always_on_top(pinned).map_err(|e| e.to_string())
}

/// The shortcut currently registered with the system, so it can be replaced.
#[cfg(desktop)]
#[derive(Default)]
struct ToggleShortcut(Mutex<Option<tauri_plugin_global_shortcut::Shortcut>>);

/// The accelerator chotto listens on until the frontend says otherwise.
#[cfg(desktop)]
const DEFAULT_TOGGLE: &str = "Super+Shift+Space";

/// Register `accelerator` as the show/hide shortcut, replacing the old one.
#[cfg(desktop)]
fn register_toggle(app: &tauri::AppHandle, accelerator: &str) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

    let shortcut: Shortcut = accelerator
        .parse()
        .map_err(|_| format!("{accelerator} is not a shortcut this system understands"))?;
    let manager = app.global_shortcut();
    let state = app.state::<ToggleShortcut>();
    let mut current = state.0.lock().map_err(|e| e.to_string())?;

    // Unregister first: the old accelerator would otherwise stay claimed
    if let Some(previous) = current.take() {
        let _ = manager.unregister(previous);
    }
    manager
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_popup(app);
            }
        })
        .map_err(|e| e.to_string())?;
    *current = Some(shortcut);
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn set_global_shortcut(accelerator: String, app: tauri::AppHandle) -> Result<(), String> {
    register_toggle(&app, &accelerator)
}

/// Mobile has no global shortcuts; the command exists so the frontend is portable.
#[cfg(not(desktop))]
#[tauri::command]
fn set_global_shortcut(_accelerator: String) -> Result<(), String> {
    Ok(())
}

/// Toggle the popup between visible and hidden.
fn toggle_popup(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create tasks table",
            sql: "CREATE TABLE tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                position REAL NOT NULL,
                due TEXT,
                tags TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
              );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add indent to tasks",
            sql: "ALTER TABLE tasks ADD COLUMN indent INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
    ];

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder
            // A second launch brings the running chotto forward. Without this
            // the new process fights the old one for the global shortcut.
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }))
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .manage(ToggleShortcut::default());
    }

    builder
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:chotto.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(Pinned::default())
        .manage(WasFocused::default())
        .invoke_handler(tauri::generate_handler![set_pinned, set_global_shortcut])
        .on_window_event(|window, event| {
            let WindowEvent::Focused(focused) = event else {
                return;
            };
            let was_focused = window.state::<WasFocused>();

            if *focused {
                if let Ok(mut held) = was_focused.0.lock() {
                    *held = true;
                }
                return;
            }

            // Only hide a window that had focus: at launch the window is shown
            // while another app is frontmost, and that arrives as a focus loss
            // too, which would hide chotto before it was ever seen.
            let held = match was_focused.0.lock() {
                Ok(mut held) => std::mem::replace(&mut *held, false),
                Err(_) => return,
            };
            let pinned = window
                .state::<Pinned>()
                .0
                .lock()
                .map(|v| *v)
                .unwrap_or(false);
            if held && !pinned {
                let _ = window.hide();
            }
        })
        .setup(|app| {
            // Keep the app out of the Dock, like a menu bar app
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // The frontend re-registers the saved accelerator once it loads;
            // until then the default keeps chotto reachable
            #[cfg(desktop)]
            if let Err(cause) = register_toggle(app.handle(), DEFAULT_TOGGLE) {
                eprintln!("could not register {DEFAULT_TOGGLE}: {cause}");
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
