import { NextResponse } from "next/server";

/**
 * Logs a failed write and returns its cause to the caller.
 *
 * The write routes are all admin-gated, so the database message is safe to expose
 * and is the only thing that makes a failure diagnosable from the browser. Without
 * it, a schema drift or constraint violation reaches the user as an empty 500 and
 * the UI looks like it silently ignored them.
 */
export function writeError(operation: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${operation}] failed:`, err);
  return NextResponse.json(
    { error: `${operation} failed`, detail: message },
    { status: 500 }
  );
}
