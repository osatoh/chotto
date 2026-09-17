import Database from "@tauri-apps/plugin-sql";

export type Task = {
  id: number;
  title: string;
  done: boolean;
  position: number;
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
    "SELECT id, title, done, position, due, tags FROM tasks ORDER BY position ASC",
  );
  return rows.map((row) => ({ ...row, done: row.done === 1 }));
}

export async function addTask(title: string): Promise<void> {
  // Append to the end; position is REAL so tasks can be inserted in between later
  await (await db()).execute(
    "INSERT INTO tasks (title, position) VALUES ($1, COALESCE((SELECT MAX(position) FROM tasks), 0) + 1)",
    [title],
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
