import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyId } from "@/lib/signed-links";
import { PublicShell, PublicMessage } from "@/components/public/PublicShell";
import { ReviewForm } from "@/components/public/ReviewForm";

export const metadata: Metadata = { title: "Leave a review", robots: { index: false } };

/**
 * /review/<bookingId>?t=<signature> - private link a business sends after an
 * appointment. No login: the signature proves the link came from them.
 */
export default async function ReviewPage({
  params, searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { bookingId } = await params;
  const { t } = await searchParams;

  if (!verifyId("review", bookingId, t)) {
    return (
      <PublicShell>
        <PublicMessage title="This link isn't valid" body="Ask the business to send you a fresh review link." />
      </PublicShell>
    );
  }

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, client_name, title, date, status")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    return <PublicShell><PublicMessage title="Appointment not found" body="It may have been removed by the business." /></PublicShell>;
  }

  const [{ data: profile }, { data: existing }] = await Promise.all([
    supabase.from("profiles").select("business_name, full_name, avatar_url, booking_link").eq("id", booking.user_id).maybeSingle(),
    supabase.from("reviews").select("rating").eq("booking_id", bookingId).maybeSingle(),
  ]);
  const businessName = profile?.business_name || profile?.full_name || "the business";
  const slug = (profile?.booking_link as { slug?: string } | null)?.slug ?? null;

  if (existing) {
    return (
      <PublicShell>
        <PublicMessage title="Thanks - you've already reviewed this" body={`Your review helps ${businessName} and other clients.`} />
      </PublicShell>
    );
  }
  if (booking.status === "cancelled") {
    return <PublicShell><PublicMessage title="This appointment was cancelled" body="There's nothing to review." /></PublicShell>;
  }
  if (String(booking.date) > new Date().toISOString().slice(0, 10)) {
    return <PublicShell><PublicMessage title="Not yet!" body="You can leave a review after your appointment." /></PublicShell>;
  }

  return (
    <PublicShell>
      <ReviewForm
        bookingId={bookingId}
        token={t!}
        businessName={businessName}
        firstName={String(booking.client_name).split(" ")[0]}
        service={booking.title}
        date={new Date(`${booking.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        bookingPageUrl={slug ? `/book/${slug}` : null}
      />
    </PublicShell>
  );
}
