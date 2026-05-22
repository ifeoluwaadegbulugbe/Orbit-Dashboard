"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Globe, CreditCard, Zap, TrendingUp, ShieldCheck,
  Smartphone, Building2, Banknote, Wallet, Apple,
  CheckCircle2, Trash2, BookOpen, Sparkles,
  type LucideIcon,
} from "lucide-react";
import { ProGate } from "@/components/paywall/ProGate";
import { useAuthStore } from "@/stores/authStore";
import { useCurrencyStore } from "@/stores/currencyStore";
import { toast } from "@/stores/toastStore";
import { PROVIDER_INFO, detectProvider } from "@/lib/payment-providers";
import { PaymentSetupWizard } from "@/components/paywall/PaymentSetupWizard";
import type { PaymentProvider } from "@/types";

const PAYMENT_CONNECTED_KEY = "orbit_payment_connected_v1";
const PAYMENT_KEYS_PREFIX = "orbit_payment_keys_";

function isValidProvider(value: string): value is PaymentProvider {
  return value in PROVIDER_INFO;
}

const BENEFITS: { icon: LucideIcon; text: string }[] = [
  { icon: Zap,         text: "Send payment links your clients can pay instantly" },
  { icon: TrendingUp,  text: "Get paid into your own bank, not Orbit's" },
  { icon: CreditCard,  text: "Payments tracked against your invoices automatically" },
  { icon: Globe,       text: "Accept cards, mobile money and bank transfers" },
  { icon: ShieldCheck, text: "Your keys stay on your device; never stored in our database" },
];

const METHOD_ICONS: Record<string, LucideIcon> = {
  Cards: CreditCard,
  "Mobile money": Smartphone,
  "Bank transfer": Building2,
  USSD: Banknote,
  "Apple Pay": Apple,
  "Google Pay": CreditCard,
  Wallets: Wallet,
  PayPal: Wallet,
};

export default function PaymentSettingsPage() {
  return (
    <ProGate
      title="Online Payments"
      description="Connect your own merchant account so client payments go straight to your bank."
    >
      <PaymentSettingsInner />
    </ProGate>
  );
}

function PaymentSettingsInner() {
  const profile = useAuthStore((s) => s.profile);
  const country = useCurrencyStore((s) => s.country);

  const [connectedProvider, setConnectedProvider] = useState<PaymentProvider | null>(null);
  const [wizardProvider, setWizardProvider] = useState<PaymentProvider | null>(null);

  // Hydrate connection state (with stale-value cleanup)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PAYMENT_CONNECTED_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { provider?: string };
      if (saved.provider && isValidProvider(saved.provider)) {
        setConnectedProvider(saved.provider);
      } else if (saved.provider) {
        // Old build saved a now-invalid provider. Clean up.
        localStorage.removeItem(PAYMENT_CONNECTED_KEY);
      }
      // Also nuke legacy keys
      ["paystack", "stripe"].forEach((legacy) => {
        localStorage.removeItem(PAYMENT_KEYS_PREFIX + legacy);
      });
    } catch {
      /* ignore */
    }
  }, []);

  const recommended = detectProvider(country.code);

  function handleDisconnect(provider: PaymentProvider) {
    const name = PROVIDER_INFO[provider].name;
    if (!confirm(`Disconnect ${name}? Your keys will be removed from this device.`)) return;
    localStorage.removeItem(PAYMENT_CONNECTED_KEY);
    localStorage.removeItem(PAYMENT_KEYS_PREFIX + provider);
    setConnectedProvider(null);
    toast(`${name} disconnected`, "default");
  }

  function refreshAfterWizard() {
    try {
      const raw = localStorage.getItem(PAYMENT_CONNECTED_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { provider?: string };
        if (saved.provider && isValidProvider(saved.provider)) {
          setConnectedProvider(saved.provider);
        }
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-page font-bold">Online Payments</h1>
        <p className="text-lead text-[var(--color-ink-light)] mt-2">
          Connect your own merchant account. Money goes to your bank, not ours.
        </p>
      </div>

      {/* Region indicator */}
      <div className="flex items-center gap-4 px-6 py-5 bg-[var(--color-primary-subtle)] border border-[var(--color-primary)]/20 rounded-[var(--radius-2xl)]">
        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
          <Globe className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-tiny font-bold uppercase tracking-wider text-[var(--color-primary)] mb-0.5">
            Your region
          </div>
          <div className="text-body font-bold text-[var(--color-ink)]">
            <span>{country.flag}</span>{"  "}{country.name}{"  ·  "}{country.currency}
          </div>
        </div>
      </div>

      {/* Help banner */}
      <Link
        href="/help#payments"
        className="flex items-center gap-4 px-6 py-5 rounded-[var(--radius-2xl)] bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-colors"
      >
        <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-subtle)] flex items-center justify-center flex-shrink-0">
          <BookOpen className="h-5 w-5 text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold text-[var(--color-ink)]">
            New to this? Read the step-by-step guide
          </div>
          <div className="text-small text-[var(--color-ink-light)] mt-0.5">
            Plain-English walkthrough of setting up your store and sending your first payment link.
          </div>
        </div>
        <span className="text-tiny font-semibold text-[var(--color-primary)]">Read it</span>
      </Link>

      {/* Provider cards. Each shows status + a single primary action */}
      <div className="space-y-4">
        {(Object.keys(PROVIDER_INFO) as PaymentProvider[]).map((p) => (
          <ProviderCard
            key={p}
            provider={p}
            isConnected={connectedProvider === p}
            isRecommended={p === recommended}
            isAlternateConnected={connectedProvider !== null && connectedProvider !== p}
            onStart={() => setWizardProvider(p)}
            onDisconnect={() => handleDisconnect(p)}
          />
        ))}
      </div>

      {/* Why connect */}
      <div className="bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm p-7">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles className="h-5 w-5 text-[var(--color-primary)]" />
          <h3 className="text-card-title font-semibold">Why connect online payments?</h3>
        </div>
        <div className="space-y-3">
          {BENEFITS.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-success-light)] flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-[var(--color-success-deep)]" />
                </div>
                <span className="text-body text-[var(--color-ink-mid)]">{b.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trust footer */}
      <div className="flex items-start gap-4 px-6 py-5 rounded-[var(--radius-2xl)] bg-[var(--color-success-light)] border border-[var(--color-success)]/20">
        <ShieldCheck className="h-5 w-5 text-[var(--color-success-deep)] flex-shrink-0 mt-0.5" />
        <p className="text-small text-[var(--color-success-deep)] leading-relaxed">
          Your keys stay on this device only. We never store them in our database.
          When a client pays, the money goes directly to your provider account.
        </p>
      </div>

      <PaymentSetupWizard
        open={wizardProvider !== null}
        provider={wizardProvider}
        onClose={() => setWizardProvider(null)}
        onComplete={refreshAfterWizard}
      />

      {/* Profile email used to ensure the connected card has data even off-screen */}
      <input type="hidden" value={profile?.email ?? ""} readOnly />
    </div>
  );
}

// ─── A single provider card. Simple status + one primary button ────────────

function ProviderCard({
  provider, isConnected, isRecommended, isAlternateConnected, onStart, onDisconnect,
}: {
  provider: PaymentProvider;
  isConnected: boolean;
  isRecommended: boolean;
  isAlternateConnected: boolean;
  onStart: () => void;
  onDisconnect: () => void;
}) {
  const info = PROVIDER_INFO[provider];

  return (
    <div
      className={`bg-white rounded-[var(--radius-2xl)] shadow-soft-sm overflow-hidden ${
        isConnected ? "border-2 border-[var(--color-success)]/45" : "border border-[var(--color-border)]"
      }`}
    >
      <div className="p-6 sm:p-7 flex items-start gap-5">
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${info.color}18` }}
        >
          <CreditCard className="h-6 w-6" style={{ color: info.color }} />
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-card-title font-bold text-[var(--color-ink)]">{info.name}</h3>
            {isConnected && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--color-success-light)] text-[var(--color-success-deep)] text-tiny font-bold">
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            )}
            {isRecommended && !isConnected && (
              <span className="text-tiny font-bold text-[var(--color-primary-dark)] bg-[var(--color-primary-subtle)] px-2 py-0.5 rounded-full">
                Recommended for you
              </span>
            )}
          </div>

          <p className="text-small text-[var(--color-ink-light)] leading-relaxed">{info.tagline}</p>
          <p className="text-small text-[var(--color-ink-light)] mt-1">{info.description}</p>

          {/* Methods */}
          <div className="mt-4 flex flex-wrap gap-2">
            {info.supportedMethods.map((m) => {
              const Icon = METHOD_ICONS[m] ?? CreditCard;
              return (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-tiny font-semibold"
                  style={{
                    backgroundColor: `${info.color}10`,
                    borderColor: `${info.color}28`,
                    color: info.color,
                  }}
                >
                  <Icon className="h-3 w-3" />
                  {m}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-t border-[var(--color-border)] px-6 sm:px-7 py-4 flex items-center justify-between gap-3">
        <span className="text-tiny text-[var(--color-muted)] leading-relaxed">
          Takes about 2 minutes. Your keys stay on this device.
        </span>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <button
                onClick={onStart}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-semibold border border-[var(--color-border)] hover:bg-[var(--color-canvas)] transition-colors"
              >
                Edit keys
              </button>
              <button
                onClick={onDisconnect}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-small font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger-light)]/40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={onStart}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-small font-bold text-white shadow-soft transition-all hover:-translate-y-px active:scale-[0.98]"
              style={{ backgroundColor: info.color }}
              title={
                isAlternateConnected
                  ? `Switch from your current provider to ${info.name}`
                  : `Get started with ${info.name}`
              }
            >
              {isAlternateConnected ? `Switch to ${info.name}` : `Get started`}
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
