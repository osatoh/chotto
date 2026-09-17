import Database from "@tauri-apps/plugin-sql";

export type Task = {
  id: number;
  title: string;
  done: boolean;
  position: number;
  /** Nesting depth; 0 is a top level task */
  indent: number;
  due: string | null;
  tags: string | null;
};

/** Row shape as stored in SQLite (done is 0/1) */
type TaskRow = Omit<Task, "done"> & { done: number };

let dbPromise: Promise<Database> | null = null;

function db(): Promise<Database> {
  dbPromise ??= Database.load("sqlite:chotto.db");
  return dbPromise;
}

export async function listTasks(): Promise<Task[]> {
  const rows = await (await db()).select<TaskRow[]>(
    "SELECT id, title, done, position, indent, due, tags FROM tasks ORDER BY position ASC",
  );
  return rows.map((row) => ({ ...row, done: row.done === 1 }));
}

/**
 * Create an empty task at `position`. Titles are typed in place, so a task
 * exists before it has a name.
 */
export async function createTask(
  position: number,
  indent: number,
): Promise<number> {
  const result = await (await db()).execute(
    "INSERT INTO tasks (title, position, indent) VALUES ('', $1, $2)",
    [position, indent],
  );
  return result.lastInsertId as number;
}

export async function setIndent(id: number, indent: number): Promise<void> {
  await (await db()).execute(
    "UPDATE tasks SET indent = $1, updated_at = datetime('now') WHERE id = $2",
    [indent, id],
  );
}

export async function renameTask(id: number, title: string): Promise<void> {
  await (await db()).execute(
    "UPDATE tasks SET title = $1, updated_at = datetime('now') WHERE id = $2",
    [title, id],
  );
}

export async function toggleTask(id: number, done: boolean): Promise<void> {
  await (await db()).execute(
    "UPDATE tasks SET done = $1, updated_at = datetime('now') WHERE id = $2",
    [done ? 1 : 0, id],
  );
}

export async function deleteTask(id: number): Promise<void> {
  await (await db()).execute("DELETE FROM tasks WHERE id = $1", [id]);
}

/** Swap the position of two tasks to exchange their order */
export async function swapPositions(a: Task, b: Task): Promise<void> {
  const conn = await db();
  await conn.execute("UPDATE tasks SET position = $1 WHERE id = $2", [b.position, a.id]);
  await conn.execute("UPDATE tasks SET position = $1 WHERE id = $2", [a.position, b.id]);
}
