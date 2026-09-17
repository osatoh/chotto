import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  addTask,
  deleteTask,
  listTasks,
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

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState(0);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [pinned, setPinned] = useState(false);
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = messages(locale);

  const reload = useCallback(async () => {
    setTasks(await listTasks());
  }, []);

  useEffect(() => {
    void reload();
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
    const next = !pinned;
    setPinned(next);
    await invoke("set_pinned", { pinned: next });
  };

  const handleKeyDown = async (event: React.KeyboardEvent) => {
    const meta = event.metaKey;
    const current = tasks[selected];

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        await getCurrentWindow().hide();
        return;

      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const next = clampSelection(selected + delta);
        // ⌘↑↓ reorders the selected task
        if (meta && current && next !== selected) {
          await swapPositions(current, tasks[next]);
          await reload();
        }
        setSelected(next);
        return;
      }

      case "Enter":
        event.preventDefault();
        if (draft.trim()) {
          await addTask(draft.trim());
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
          setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]);
        }
        return;

      case "l":
        if (meta) {
          // ⌘L: cycles the UI language (en / ja for now)
          event.preventDefault();
          setLocale(LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length]);
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

  return (
    <div className="popup" onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        className="popup__input"
        placeholder={t.inputPlaceholder}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
      />

      <ul className="list">
        {tasks.length === 0 && (
          <li className="list__empty">{t.empty}</li>
        )}
        {tasks.map((task, index) => (
          <li
            key={task.id}
            className={`task${index === selected ? " task--selected" : ""}`}
            onClick={() => setSelected(index)}
          >
            <span className="task__check">{task.done ? "✓" : ""}</span>
            <span className={task.done ? "task__title--done" : undefined}>
              {task.title}
            </span>
          </li>
        ))}
      </ul>

      <footer className="footer">
        <span>{t.hints}</span>
        <span className="footer__actions">
          <button
            type="button"
            className="footer__button"
            onClick={() =>
              setLocale(LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length])
            }
          >
            {t.localeLabel}
          </button>
          <button
            type="button"
            className={`footer__button${pinned ? " footer__button--on" : ""}`}
            onClick={() => void togglePin()}
          >
            {pinned ? t.pinned : t.pin}
          </button>
        </span>
      </footer>
    </div>
  );
}
