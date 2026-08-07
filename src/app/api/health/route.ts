export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(process.env.DATABASE_URL);

  // The Postgres ledger is optional: the app runs fully on localStorage
  // when DATABASE_URL is not configured, so the health route must not
  // hard-require the database at module load.
  if (!configured) {
    return Response.json({ ok: true, database: "not-configured" });
  }

  try {
    const { pool } = await import("@/db");
    await pool.query("SELECT 1");
    return Response.json({ ok: true, database: "connected" });
  } catch {
    return Response.json({ ok: false, database: "error" }, { status: 500 });
  }
}
