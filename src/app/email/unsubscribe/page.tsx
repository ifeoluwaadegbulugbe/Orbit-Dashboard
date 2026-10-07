import type { Metadata } from "next";
import { verifyId } from "@/lib/signed-links";
import { PublicShell, PublicMessage } from "@/components/public/PublicShell";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/**
 * Landing page for the "Unsubscribe" link in lifecycle emails. Shows a
 * confirm button (POST) rather than unsubscribing on page load, so email
 * security scanners that open links can't unsubscribe anyone by accident.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string; done?: string }>;
}) {
  const { u = "", t, done } = await searchParams;
  const valid = /^[0-9a-f-]{36}$/i.test(u) && verifyId("unsub", u, t);

  if (!valid) {
    return <PublicShell><PublicMessage title="This link isn't valid" body="You can change your email settings any time in Orbit under Settings → Email preferences." /></PublicShell>;
  }
  if (done) {
    return (
      <PublicShell>
        <PublicMessage
          title="You're unsubscribed"
          body="You won't get tips, updates or offers from Orbit any more. Important emails about your account, security and payments will still reach you. Changed your mind? Turn them back on under Settings → Email preferences."
        />
      </PublicShell>
    );
  }
  return (
    <PublicShell>
      <form
        method="post"
        action={`/api/email/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t ?? "")}`}
        className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-6 sm:p-8 text-center"
      >
        <h1 className="text-card-title font-bold">Unsubscribe from Orbit emails?</h1>
        <p className="mt-2 text-small text-[var(--color-ink-light)] leading-relaxed">
          You&apos;ll stop getting setup tips, product updates and offers. Important emails about your
          account, security and payments will still be sent.
        </p>
        <input type="hidden" name="confirm" value="1" />
        <button type="submit" className="mt-5 inline-flex px-6 py-3 rounded-full bg-[var(--color-ink)] text-white text-small font-bold">
          Unsubscribe
        </button>
        <p className="mt-4 text-tiny text-[var(--color-muted)]">
          Prefer fewer emails instead? Choose what you get under Settings → Email preferences.
        </p>
      </form>
    </PublicShell>
  );
}
