import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { PublicBookingForm } from "@/components/public/PublicBookingForm";

interface Service {
  name: string;
  duration_minutes: number;
  price: string;
}

interface BookingConfig {
  slug: string;
  intro: string;
  services: Service[];
  availability: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  business_name: string | null;
  avatar_url: string | null;
  booking_link: BookingConfig | null;
}

/**
 * Public booking page. Anyone with the link can open this, no login needed.
 * Each business owner has their own slug (set in /booking-link).
 *
 * URL: /book/<slug>  e.g. /book/glam-by-amaka
 */
export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!slug) notFound();

  // Look up the business owner by slug using a service-role client (visitor
  // is not logged in, so we can't rely on the visitor's RLS).
  let profile: ProfileRow | null = null;
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, avatar_url, booking_link")
      .eq("booking_link->>slug", slug)
      .maybeSingle();
    if (error) {
      console.warn("[public-booking] lookup failed:", error.message);
    }
    profile = (data as ProfileRow | null) ?? null;
  } catch (err) {
    console.warn("[public-booking] db error:", err);
  }

  if (!profile || !profile.booking_link) {
    notFound();
  }

  const config = profile.booking_link;
  const displayName = profile.business_name || profile.full_name || "this business";

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-card-title font-bold">
            Orbit<span className="text-[var(--color-primary)]">.</span>
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Business hero */}
        <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm overflow-hidden">
          <div className="px-8 pt-8 pb-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-primary-subtle)] mx-auto mb-5 flex items-center justify-center">
              {profile.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="w-20 h-20 rounded-2xl object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-[var(--color-primary)]">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h1 className="text-page font-bold tracking-tight">
              Book with {displayName}
            </h1>
            <p className="mt-3 text-body text-[var(--color-ink-light)] leading-relaxed">
              {config.intro || "Pick a service and a time. I'll confirm shortly."}
            </p>
            {config.availability && (
              <p className="mt-2 text-small text-[var(--color-muted)]">
                Usually available: {config.availability}
              </p>
            )}
          </div>

          {/* Booking form */}
          <div className="border-t border-[var(--color-border)] p-8">
            <PublicBookingForm
              slug={slug}
              businessName={displayName}
              services={config.services ?? []}
            />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-tiny text-[var(--color-muted)] mt-8">
          Powered by Orbit · <a href="/" className="font-semibold hover:text-[var(--color-primary)]">Run your own business with Orbit</a>
        </p>
      </main>
    </div>
  );
}
