// Applies DB_SCHEMA once per server process, before the first request is served.
//
// The schema in src/lib/db.ts is idempotent (CREATE TABLE IF NOT EXISTS / ADD COLUMN
// IF NOT EXISTS), but initDB() used to be reachable only from the bulk import route,
// so ALTER lines added alongside a code change were never applied on deploy. A commit
// that added a column to the INSERT in /api/events shipped ahead of its migration and
// broke Add Event in production with a bare 500. Running it at boot keeps the deployed
// schema in step with the code that expects it.
export async function register() {
  // register() also runs in the edge runtime, which has no pg driver.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { initDB } = await import("@/lib/db");

  try {
    await initDB();
    console.log("[instrumentation] schema up to date");
  } catch (err) {
    // Never block boot on this. Reads work against the existing schema, and two
    // instances starting together can collide on IF NOT EXISTS. A failure here
    // resurfaces as a write error from the route, which now reports its cause.
    console.error("[instrumentation] schema migration failed:", err);
  }
}
