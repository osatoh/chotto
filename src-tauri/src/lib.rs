use std::sync::Mutex;

use tauri::{Manager, State, WindowEvent};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Pin state. While true the window stays visible even when it loses focus.
#[derive(Default)]
struct Pinned(Mutex<bool>);

#[tauri::command]
fn set_pinned(pinned: bool, state: State<'_, Pinned>, window: tauri::Window) -> Result<(), String> {
    *state.0.lock().map_err(|e| e.to_string())? = pinned;
    window.set_always_on_top(pinned).map_err(|e| e.to_string())
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
        use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

        // Global shortcut: ⌘⇧Space
        let toggle_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space);
        builder = builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(toggle_shortcut)
                .expect("failed to register global shortcut")
                .with_handler(move |app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed && shortcut == &toggle_shortcut {
                        toggle_popup(app);
                    }
                })
                .build(),
        );
    }

    builder
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:chotto.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .manage(Pinned::default())
        .invoke_handler(tauri::generate_handler![set_pinned])
        .on_window_event(|window, event| {
            // Hide on focus loss, unless pinned
            if let WindowEvent::Focused(false) = event {
                let pinned = window
                    .state::<Pinned>()
                    .0
                    .lock()
                    .map(|v| *v)
                    .unwrap_or(false);
                if !pinned {
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            // Keep the app out of the Dock, like a menu bar app
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
