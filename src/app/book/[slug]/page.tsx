import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Sparkles, MapPin, Clock, MessageCircle, AtSign, Navigation, Star } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { PublicBookingForm } from "@/components/public/PublicBookingForm";
import {
  type BookingConfig, directionsUrl, instagramUrl, whatsappUrl,
} from "@/lib/booking-profile";

interface ProfileRow {
  id: string;
  full_name: string | null;
  business_name: string | null;
  avatar_url: string | null;
  booking_link: BookingConfig | null;
}

interface PublicReview {
  id: string;
  client_name: string;
  rating: number;
  comment: string | null;
  service: string | null;
  created_at: string;
}

/** Profile + visible reviews for a slug. cache() so metadata and page share one lookup. */
const loadBusiness = cache(async (slug: string) => {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, business_name, avatar_url, booking_link")
    .eq("booking_link->>slug", slug)
    .maybeSingle();
  if (error) console.warn("[public-booking] lookup failed:", error.message);
  const profile = (data as ProfileRow | null) ?? null;
  if (!profile?.booking_link) return null;

  // Reviews are optional - if migration 014 hasn't run, the page still works.
  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id, client_name, rating, comment, service, created_at")
    .eq("user_id", profile.id)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(50);
  const reviews = (reviewRows as PublicReview[] | null) ?? [];
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;

  return {
    profile,
    config: profile.booking_link,
    name: profile.business_name || profile.full_name || "this business",
    reviews,
    avg,
  };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const biz = await loadBusiness(slug);
  if (!biz) return { title: "Booking page not found" };
  const rating = biz.avg ? ` · ${biz.avg.toFixed(1)}★ (${biz.reviews.length} reviews)` : "";
  const description = `${biz.config.intro || `Book an appointment with ${biz.name}.`}${rating}`.slice(0, 200);
  const image = biz.config.photos?.[0] || (biz.profile.avatar_url?.startsWith("http") ? biz.profile.avatar_url : undefined);
  return {
    title: `Book with ${biz.name}`,
    description,
    openGraph: { title: `Book with ${biz.name}`, description, images: image ? [image] : undefined, type: "website" },
    twitter: { card: image ? "summary_large_image" : "summary", title: `Book with ${biz.name}`, description },
  };
}

/**
 * Public booking page - the business's front door. Anyone with the link
 * can open it, no login needed. URL: /book/<slug>
 *
 * Query params (used by "Book again" links): ?services=A|B&name=&phone=&email=
 */
export default async function PublicBookingPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  if (!slug) notFound();
  const biz = await loadBusiness(slug);
  if (!biz) notFound();

  const { profile, config, name, reviews, avg } = biz;
  const photos = (config.photos ?? []).slice(0, 8);
  const wa = whatsappUrl(config.whatsapp, `Hi ${name}, I found you on your Orbit booking page.`);
  const ig = instagramUrl(config.instagram);
  const maps = directionsUrl(config.location);
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const presetServices = first(sp.services).split("|").filter(Boolean);

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-body font-bold">
            Orbit<span className="text-[var(--color-primary)]">.</span>
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5 sm:space-y-6">
        {/* ── Profile ── */}
        <section className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-[var(--color-primary)]">{name.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-section font-bold tracking-tight break-words">{name}</h1>
              {avg !== null && (
                <a href="#reviews" className="mt-1 inline-flex items-center gap-1.5 text-small">
                  <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                  <span className="font-bold">{avg.toFixed(1)}</span>
                  <span className="text-[var(--color-muted)] underline-offset-2 hover:underline">
                    {reviews.length} review{reviews.length === 1 ? "" : "s"}
                  </span>
                </a>
              )}
              <div className="mt-2 space-y-1 text-small text-[var(--color-ink-light)]">
                {config.location && (
                  <p className="flex items-start gap-1.5"><MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />{config.location}</p>
                )}
                {config.availability && (
                  <p className="flex items-start gap-1.5"><Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />{config.availability}</p>
                )}
              </div>
            </div>
          </div>

          {config.intro && (
            <p className="mt-5 text-body text-[var(--color-ink-mid)] leading-relaxed">{config.intro}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#book" className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-[var(--color-primary)] text-white text-small font-bold hover:bg-[var(--color-primary-dark)] transition-colors">
              Book now
            </a>
            {wa && <Action href={wa} icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" />}
            {ig && <Action href={ig} icon={<AtSign className="h-4 w-4" />} label="Instagram" />}
            {maps && <Action href={maps} icon={<Navigation className="h-4 w-4" />} label="Directions" />}
          </div>
        </section>

        {/* ── Work photos ── */}
        {photos.length > 0 && (
          <section aria-label="Photos of our work">
            <div className="flex sm:grid sm:grid-cols-3 gap-2 sm:gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
              {photos.map((src, i) => (
                <a
                  key={src}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="snap-start flex-shrink-0 w-[70%] sm:w-auto aspect-square rounded-[var(--radius-xl)] overflow-hidden bg-white border border-[var(--color-border)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`${name} - work ${i + 1}`} loading={i < 3 ? "eager" : "lazy"} className="w-full h-full object-cover hover:scale-[1.03] transition-transform" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ── Services ── */}
        {config.services?.length > 0 && (
          <section className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7">
            <h2 className="text-card-title font-semibold mb-2">Services</h2>
            <ul className="divide-y divide-[var(--color-border)]">
              {config.services.filter((s) => s.name?.trim()).map((s) => (
                <li key={s.name} className="flex items-baseline justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="text-body font-semibold">{s.name}</div>
                    {s.duration_minutes > 0 && <div className="text-small text-[var(--color-muted)]">{formatDuration(s.duration_minutes)}</div>}
                  </div>
                  <div className="text-body font-bold whitespace-nowrap">{s.price || "Price on request"}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Reviews ── */}
        {reviews.length > 0 && (
          <section id="reviews" className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-7 scroll-mt-4">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 className="text-card-title font-semibold">Reviews</h2>
              <span className="inline-flex items-center gap-1 text-small">
                <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                <b>{avg!.toFixed(1)}</b>
                <span className="text-[var(--color-muted)]">· {reviews.length}</span>
              </span>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {reviews.slice(0, 10).map((r) => (
                <li key={r.id} className="py-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex" aria-label={`${r.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i <= r.rating ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[var(--color-border)]"}`} />
                      ))}
                    </span>
                    <span className="text-small font-semibold">{firstNameInitial(r.client_name)}</span>
                    <span className="text-tiny text-[var(--color-muted)]">
                      {new Date(r.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                    </span>
                  </div>
                  {r.comment && <p className="mt-1.5 text-small text-[var(--color-ink-mid)] leading-relaxed">{r.comment}</p>}
                  {r.service && <p className="mt-1 text-tiny text-[var(--color-muted)]">{r.service}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Booking form ── */}
        <section id="book" className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-5 sm:p-8 scroll-mt-4">
          <h2 className="text-card-title font-semibold mb-5">Book an appointment</h2>
          <PublicBookingForm
            slug={slug}
            businessName={name}
            services={config.services ?? []}
            initialServices={presetServices}
            initialName={first(sp.name)}
            initialPhone={first(sp.phone)}
            initialEmail={first(sp.email)}
          />
        </section>

        <p className="text-center text-tiny text-[var(--color-muted)] pb-4">
          Powered by Orbit · <a href="/" className="font-semibold hover:text-[var(--color-primary)]">Run your own business with Orbit</a>
        </p>
      </main>
    </div>
  );
}

function Action({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-full bg-white border border-[var(--color-border)] text-small font-semibold hover:border-[var(--color-primary)]/40 transition-colors"
    >
      {icon} {label}
    </a>
  );
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** "Sayo Ayanfe" -> "Sayo A." - reviewers' full names aren't shown publicly. */
function firstNameInitial(full: string): string {
  const [first, last] = full.trim().split(/\s+/);
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}
