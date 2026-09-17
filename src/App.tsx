import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  addTask,
  deleteTask,
  listTasks,
  renameTask,
  setIndent,
  swapPositions,
  toggleTask,
  type Task,
} from "./lib/db";
import {
  LOCALES,
  loadLocale,
  messages,
  saveLocale,
  type Locale,
} from "./lib/i18n";
import "./styles/themes.css";
import "./styles/app.css";

const THEMES = ["flexoki-light", "flexoki-dark", "dracula", "nord"] as const;
type Theme = (typeof THEMES)[number];

const THEME_KEY = "chotto.theme";

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return THEMES.includes(saved as Theme) ? (saved as Theme) : "flexoki-light";
}

/** A line may sit at most one level deeper than the line above it */
function maxIndent(previous: Task | undefined): number {
  return previous ? previous.indent + 1 : 0;
}

function next<T>(values: readonly T[], current: T): T {
  return values[(values.indexOf(current) + 1) % values.length];
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState(0);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [pinned, setPinned] = useState(false);
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftIndent, setDraftIndent] = useState(0);
  const [editing, setEditing] = useState<{ id: number; title: string } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const t = messages(locale);

  const reload = useCallback(async () => {
    setTasks(await listTasks());
  }, []);

  useEffect(() => {
    void reload().catch((cause) => setError(String(cause)));
  }, [reload]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    saveLocale(locale);
  }, [locale]);

  // Return focus to the input every time the popup is shown again
  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) inputRef.current?.focus();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const clampSelection = (index: number) =>
    Math.max(0, Math.min(index, tasks.length - 1));

  const togglePin = async () => {
    const pin = !pinned;
    setPinned(pin);
    await invoke("set_pinned", { pinned: pin });
  };

  const runKeyDown = async (event: KeyboardEvent) => {
    // While the IME is composing, Enter confirms the conversion — not a task
    if (event.isComposing) return;

    const meta = event.metaKey;
    const current = tasks[selected];

    // While a task is being renamed the edit field owns every key but these
    if (editing) {
      if (event.key === "Enter") {
        event.preventDefault();
        await commitEdit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setEditing(null);
      }
      return;
    }

    switch (event.key) {
      case ",":
        if (meta) {
          event.preventDefault();
          setSettingsOpen((open) => !open);
        }
        return;

      case "Escape":
        event.preventDefault();
        // Esc closes the settings panel first, then hides the window
        if (settingsOpen) {
          setSettingsOpen(false);
        } else {
          await getCurrentWindow().hide();
        }
        return;

      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const target = clampSelection(selected + delta);
        // ⌘↑↓ reorders the selected task
        if (meta && current && target !== selected) {
          await swapPositions(current, tasks[target]);
          await reload();
        }
        setSelected(target);
        return;
      }

      case "Tab": {
        // Tab indents the line being typed, or the selected task when idle
        event.preventDefault();
        const step = event.shiftKey ? -1 : 1;
        if (draft) {
          const limit = maxIndent(tasks[tasks.length - 1]);
          setDraftIndent(Math.max(0, Math.min(draftIndent + step, limit)));
        } else if (current) {
          const limit = maxIndent(tasks[selected - 1]);
          const indent = Math.max(0, Math.min(current.indent + step, limit));
          if (indent !== current.indent) {
            await setIndent(current.id, indent);
            await reload();
          }
        }
        return;
      }

      case "Enter":
        event.preventDefault();
        if (draft.trim()) {
          await addTask(draft.trim(), draftIndent);
          setDraft("");
          await reload();
        } else if (current) {
          await toggleTask(current.id, !current.done);
          await reload();
        }
        return;

      case "Backspace":
        if (meta && current) {
          event.preventDefault();
          await deleteTask(current.id);
          setSelected(clampSelection(selected - 1));
          await reload();
        }
        return;

      case "k":
        if (meta) {
          // ⌘K: cycles themes for now (command palette comes later)
          event.preventDefault();
          setTheme(next(THEMES, theme));
        }
        return;

      case "l":
        if (meta) {
          event.preventDefault();
          setLocale(next(LOCALES, locale));
        }
        return;

      case "e":
        if (meta && current) {
          event.preventDefault();
          setEditing({ id: current.id, title: current.title });
        }
        return;

      case "p":
        if (meta) {
          event.preventDefault();
          await togglePin();
        }
        return;
    }
  };

  // Listen on the window, not on the popup: the settings panel has nothing
  // focusable, so a handler on an element would never see Esc there.
  // Re-registered on every render so the handler always reads fresh state.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Nothing else reports failures, so a swallowed rejection would look
      // like a key that simply does nothing
      setError(null);
      void runKeyDown(event).catch((cause) => setError(String(cause)));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const commitEdit = async () => {
    if (!editing) return;
    const title = editing.title.trim();
    setEditing(null);
    // An emptied title is a cancel, not a delete
    if (!title) return;
    await renameTask(editing.id, title);
    await reload();
  };

  const toggleSelected = (task: Task) => {
    void toggleTask(task.id, !task.done)
      .then(reload)
      .catch((cause) => setError(String(cause)));
  };

  return (
    <div className="popup">
      {settingsOpen ? (
        <div className="settings">
          <header className="settings__header">
            <h1 className="settings__title">{t.settings}</h1>
            <button
              type="button"
              className="settings__close"
              onClick={() => setSettingsOpen(false)}
            >
              {t.close}
            </button>
          </header>

          <button
            type="button"
            className="settings__row"
            onClick={() => setTheme(next(THEMES, theme))}
          >
            <span>{t.theme}</span>
            <span className="settings__value">{theme}</span>
          </button>

          <button
            type="button"
            className="settings__row"
            onClick={() => setLocale(next(LOCALES, locale))}
          >
            <span>{t.language}</span>
            <span className="settings__value">{t.localeLabel}</span>
          </button>

          <button
            type="button"
            className="settings__row"
            onClick={() => void togglePin()}
          >
            <span>{t.pin}</span>
            <span className="settings__value">{pinned ? t.on : t.off}</span>
          </button>

          <dl className="shortcuts">
            {t.shortcuts.map((shortcut) => (
              <div className="shortcuts__row" key={shortcut.keys}>
                <dt className="shortcuts__keys">{shortcut.keys}</dt>
                <dd className="shortcuts__description">{shortcut.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <ul className="list">
          {tasks.map((task, index) => (
            <li
              key={task.id}
              className={`task${index === selected ? " task--selected" : ""}`}
              style={{ paddingLeft: `${16 + task.indent * 22}px` }}
              onClick={() => setSelected(index)}
            >
              <span
                className={`checkbox${task.done ? " checkbox--checked" : ""}`}
                onClick={() => toggleSelected(task)}
              />
              {editing?.id === task.id ? (
                <input
                  className="task__input"
                  value={editing.title}
                  autoFocus
                  onChange={(event) =>
                    setEditing({ id: task.id, title: event.target.value })
                  }
                  onBlur={() => void commitEdit().catch((cause) => setError(String(cause)))}
                />
              ) : (
                <span
                  className={`task__title${task.done ? " task__title--done" : ""}`}
                  onClick={() => setEditing({ id: task.id, title: task.title })}
                >
                  {task.title}
                </span>
              )}
            </li>
          ))}

          {/* The last line is the input: a task starts as an empty checkbox */}
          <li
            className="task task--draft"
            style={{ paddingLeft: `${16 + draftIndent * 22}px` }}
          >
            <span className="checkbox" />
            <input
              ref={inputRef}
              className="task__input"
              placeholder={t.inputPlaceholder}
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
            />
          </li>
        </ul>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
