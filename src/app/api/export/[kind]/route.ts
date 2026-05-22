import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Kind = "clients" | "payments" | "bookings" | "reminders";

const ALLOWED: Kind[] = ["clients", "payments", "bookings", "reminders"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  if (!ALLOWED.includes(kind as Kind)) {
    return NextResponse.json({ error: "Unknown export kind" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from(kind)
    .select("*")
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const csv = toCsv(data ?? []);
  const filename = `orbit-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** Convert array of rows → CSV string. Handles commas, quotes, newlines, nulls. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows
    .map((row) =>
      keys
        .map((k) => escapeCsv(row[k]))
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
