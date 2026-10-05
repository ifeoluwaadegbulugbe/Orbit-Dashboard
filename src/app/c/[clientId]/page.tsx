import type { Metadata } from "next";
import { CalendarDays, Clock, Receipt, Star, RotateCcw, Plus, MessageCircle } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyId, signId } from "@/lib/signed-links";
import { PublicShell, PublicMessage } from "@/components/public/PublicShell";
import { whatsappUrl, type BookingConfig } from "@/lib/booking-profile";

export const metadata: Metadata = { title: "My appointments", robots: { index: false } };

interface BookingRow { id: string; title: string; date: string; time: string | null; status: string }
interface InvoiceRow {
  id: string; invoice_number: string | null; amount: number; remaining_balance: number | null;
  status: string; date: string; payment_link: string | null;
}

/**
 * /c/<clientId>?t=<signature> - a client's private page with one business:
 * upcoming and past appointments, invoices, one-tap "Book again" and
 * review links. No account needed; the signed link is the key.
 */
export default async function ClientPortalPage({
  params, searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { clientId } = await params;
  const { t } = await searchParams;

  if (!verifyId("client", clientId, t)) {
    return <PublicShell><PublicMessage title="This link isn't valid" body="Ask the business to send you your link again." /></PublicShell>;
  }

  const supabase = createServiceClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, user_id, name, phone, email")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) {
    return <PublicShell><PublicMessage title="Not found" body="This page is no longer available." /></PublicShell>;
  }

  const [{ data: profile }, { data: bookingRows }, { data: invoiceRows }, { data: reviewRows }] = await Promise.all([
    supabase.from("profiles").select("business_name, full_name, avatar_url, booking_link").eq("id", client.user_id).maybeSingle(),
    supabase.from("bookings").select("id, title, date, time, status").eq("client_id", clientId).order("date", { ascending: false }).limit(60),
    supabase.from("payments").select("id, invoice_number, amount, remaining_balance, status, date, payment_link").eq("client_id", clientId).order("date", { ascending: false }).limit(30),
    supabase.from("reviews").select("booking_id").eq("client_id", clientId),
  ]);

  const config = (profile?.booking_link as BookingConfig | null) ?? null;
  const businessName = profile?.business_name || profile?.full_name || "your provider";
  const firstName = String(client.name).split(" ")[0];
  const today = new Date().toISOString().slice(0, 10);
  const bookings = (bookingRows as BookingRow[] | null) ?? [];
  const upcoming = bookings.filter((b) => b.date >= today && b.status !== "cancelled").reverse();
  const past = bookings.filter((b) => b.date < today).slice(0, 10);
  const reviewed = new Set(((reviewRows as { booking_id: string }[] | null) ?? []).map((r) => r.booking_id));
  const invoices = (invoiceRows as InvoiceRow[] | null) ?? [];
  const unpaid = invoices.filter((i) => i.status !== "paid" && i.status !== "refunded" && i.status !== "failed");

  const rebookUrl = (title?: string) => {
    if (!config?.slug) return null;
    const q = new URLSearchParams({ name: client.name ?? "" });
    if (client.phone) q.set("phone", client.phone);
    if (client.email) q.set("email", client.email);
    if (title) q.set("services", title.split(" + ").join("|"));
    return `/book/${config.slug}?${q.toString()}#book`;
  };
  const wa = whatsappUrl(config?.whatsapp, `Hi ${businessName}, it's ${client.name}.`);
  const money = (n: number) => `₦${Number(n).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
  const when = (b: BookingRow) =>
    `${new Date(`${b.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}${b.time ? ` · ${fmtTime(b.time)}` : ""}`;

  return (
    <PublicShell>
      {/* Header */}
      <section className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center overflow-hidden flex-shrink-0">
            {profile?.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-[var(--color-primary)]">{businessName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-small text-[var(--color-muted)]">Hi {firstName}, your appointments with</p>
            <h1 className="text-card-title font-bold break-words">{businessName}</h1>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {rebookUrl() && (
            <a href={rebookUrl()!} className="flex-1 min-w-[150px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--color-primary)] text-white text-small font-bold">
              <Plus className="h-4 w-4" /> New appointment
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full border border-[var(--color-border)] text-small font-semibold">
              <MessageCircle className="h-4 w-4" /> Message
            </a>
          )}
        </div>
      </section>

      {/* Upcoming */}
      <Card title="Upcoming" icon={<CalendarDays className="h-4 w-4" />}>
        {upcoming.length === 0 ? (
          <Empty text="Nothing booked yet." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {upcoming.map((b) => (
              <li key={b.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-small font-semibold truncate">{b.title}</div>
                  <div className="text-tiny text-[var(--color-muted)] flex items-center gap-1"><Clock className="h-3 w-3" />{when(b)}</div>
                </div>
                <StatusPill status={b.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Invoices */}
      {unpaid.length > 0 && (
        <Card title="To pay" icon={<Receipt className="h-4 w-4" />}>
          <ul className="divide-y divide-[var(--color-border)]">
            {unpaid.map((i) => (
              <li key={i.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-small font-semibold">{money(i.remaining_balance ?? i.amount)}</div>
                  <div className="text-tiny text-[var(--color-muted)]">{i.invoice_number ?? "Invoice"} · due {i.date}</div>
                </div>
                {i.payment_link ? (
                  <a href={i.payment_link} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-full bg-[var(--color-ink)] text-white text-tiny font-bold">Pay now</a>
                ) : (
                  <span className="text-tiny text-[var(--color-muted)]">Pay {businessName} directly</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Past */}
      {past.length > 0 && (
        <Card title="Past appointments" icon={<RotateCcw className="h-4 w-4" />}>
          <ul className="divide-y divide-[var(--color-border)]">
            {past.map((b) => {
              const canReview = b.status !== "cancelled" && !reviewed.has(b.id);
              const again = rebookUrl(b.title);
              return (
                <li key={b.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-small font-semibold truncate">{b.title}</div>
                      <div className="text-tiny text-[var(--color-muted)]">{when(b)}{b.status === "cancelled" ? " · cancelled" : ""}</div>
                    </div>
                  </div>
                  {(again || canReview) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {again && b.status !== "cancelled" && (
                        <a href={again} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary-dark)] text-tiny font-bold">
                          <RotateCcw className="h-3.5 w-3.5" /> Book again
                        </a>
                      )}
                      {canReview && (
                        <a href={`/review/${b.id}?t=${signId("review", b.id)}`} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--color-border)] text-tiny font-bold">
                          <Star className="h-3.5 w-3.5" /> Leave a review
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="text-center text-tiny text-[var(--color-muted)]">
        This is your private link - keep it to yourself. Powered by Orbit.
      </p>
    </PublicShell>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm px-5 sm:px-7 pt-5 pb-2">
      <h2 className="text-body font-semibold flex items-center gap-2 text-[var(--color-ink)]">
        <span className="text-[var(--color-primary)]">{icon}</span>{title}
      </h2>
      <div className="mt-1">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-3 text-small text-[var(--color-muted)]">{text}</p>;
}

function StatusPill({ status }: { status: string }) {
  const style = status === "confirmed"
    ? "bg-[var(--color-success-light)] text-[var(--color-success-deep)]"
    : status === "pending"
      ? "bg-[var(--color-warning-light)] text-[var(--color-warning-deep)]"
      : "bg-[var(--color-border-light)] text-[var(--color-ink-light)]";
  const label = status === "pending" ? "Awaiting confirmation" : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`flex-shrink-0 px-2.5 py-1 rounded-full text-tiny font-bold ${style}`}>{label}</span>;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m || 0).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}
