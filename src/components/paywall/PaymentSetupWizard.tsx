// components/paywall/PaymentSetupWizard.tsx
//
// A step-by-step modal that walks the business owner through connecting a
// payment provider. It supports every provider defined in PROVIDER_INFO —
// the wizard steps and fields are driven by the provider config, so adding
// a new provider in payment-providers.ts automatically works here too.
//
// Steps:
//   1. Instructions  — "Here's what you'll need"
//   2. Enter keys    — one input per wizardFields entry
//   3. Verify        — calls our backend to confirm the keys work
//   4. Done          — confirms connection and closes
//
// Keys are stored in localStorage only. Never sent to Orbit's database.

"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import {
  PROVIDER_INFO,
  saveProviderKeys,
  type PaymentProvider,
} from "@/lib/payment-providers";

// ─── Props ───────────────────────────────────────────────────────────────────

interface PaymentSetupWizardProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Which provider to set up. Null means the modal is closed. */
  provider: PaymentProvider | null;
  /** Called when the user dismisses the modal (X button or Cancel). */
  onClose: () => void;
  /** Called after the user successfully connects a provider. */
  onComplete: () => void;
}

// ─── Step labels ─────────────────────────────────────────────────────────────

type Step = "instructions" | "keys" | "verifying" | "done";

// ─── Component ───────────────────────────────────────────────────────────────

export function PaymentSetupWizard({
  open,
  provider,
  onClose,
  onComplete,
}: PaymentSetupWizardProps) {
  const [step, setStep] = useState<Step>("instructions");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);

  // Reset state whenever the modal is opened for a new provider
  useEffect(() => {
    if (open) {
      setStep("instructions");
      setFieldValues({});
      setError(null);
      setAccountName(null);
    }
  }, [open, provider]);

  // Don't render anything when closed
  if (!open || !provider) return null;

  const info = PROVIDER_INFO[provider];

  // ── Handlers ───────────────────────────────────────────────────────────

  function handleFieldChange(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    setError(null); // clear error when user types
  }

  async function handleVerify() {
    setError(null);

    // Check all fields are filled
    for (const field of info.wizardFields) {
      if (!fieldValues[field.key]?.trim()) {
        setError(`Please enter your ${field.label.toLowerCase()}.`);
        return;
      }
    }

    setStep("verifying");

    try {
      if (provider === "stripe") {
        // ── Stripe: hit our verification endpoint ───────────────────────
        const res = await fetch("/api/payments/stripe/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secretKey: fieldValues.secretKey }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Verification failed. Check your key and try again.");
          setStep("keys");
          return;
        }

        // Save keys locally
        saveProviderKeys(provider, fieldValues);
        setAccountName(data.accountName);
        setIsLiveMode(data.liveMode);
        setStep("done");

      } else if (provider === "flutterwave") {
        // ── Flutterwave: basic format check (unchanged from original logic) ─
        const { secretKey, publicKey } = fieldValues;

        if (!secretKey.startsWith("FLWSECK") && !secretKey.startsWith("FLWSECK_TEST")) {
          setError("Secret key should start with FLWSECK_ or FLWSECK_TEST-");
          setStep("keys");
          return;
        }
        if (!publicKey.startsWith("FLWPUBK") && !publicKey.startsWith("FLWPUBK_TEST")) {
          setError("Public key should start with FLWPUBK_ or FLWPUBK_TEST-");
          setStep("keys");
          return;
        }

        saveProviderKeys(provider, fieldValues);
        setAccountName("your Flutterwave account");
        setIsLiveMode(!secretKey.includes("_TEST"));
        setStep("done");
      }
    } catch {
      setError("Could not connect. Check your internet connection and try again.");
      setStep("keys");
    }
  }

  function handleDone() {
    onComplete();
    onClose();
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    // Backdrop — click outside to close
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-lg bg-white rounded-[var(--radius-2xl)] shadow-2xl overflow-hidden">

        {/* Header */}
        <div
          className="px-7 py-5 flex items-center gap-4"
          style={{ backgroundColor: `${info.color}12` }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${info.color}22` }}
          >
            {/* Simple $ icon as placeholder for provider logo */}
            <span className="text-xl font-bold" style={{ color: info.color }}>
              {info.name[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)]">
              Connect provider
            </p>
            <h2 className="text-card-title font-bold text-[var(--color-ink)]">
              {info.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-[var(--color-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-5">

          {/* ── Step 1: Instructions ─────────────────────────────────── */}
          {step === "instructions" && (
            <>
              <p className="text-body text-[var(--color-ink-mid)] leading-relaxed">
                {info.tagline}. You&apos;ll need your API key from the{" "}
                <a
                  href={info.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline"
                  style={{ color: info.color }}
                >
                  {info.name} dashboard
                  <ExternalLink className="inline ml-1 h-3 w-3" />
                </a>
                .
              </p>

              <div className="space-y-3">
                {info.wizardFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-start gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]"
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                      style={{ backgroundColor: info.color }}
                    />
                    <div>
                      <p className="text-body font-semibold text-[var(--color-ink)]">
                        {field.label}
                      </p>
                      <p className="text-small text-[var(--color-muted)] mt-0.5">
                        {field.hint}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-full border border-[var(--color-border)] text-small font-semibold hover:bg-[var(--color-canvas)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep("keys")}
                  className="flex-1 py-2.5 rounded-full text-small font-bold text-white transition-all hover:-translate-y-px active:scale-[0.98]"
                  style={{ backgroundColor: info.color }}
                >
                  I have my key — continue
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: Enter keys ───────────────────────────────────── */}
          {step === "keys" && (
            <>
              <p className="text-body text-[var(--color-ink-mid)]">
                Paste your key{info.wizardFields.length > 1 ? "s" : ""} below.
                They stay on this device — Orbit never stores them.
              </p>

              <div className="space-y-4">
                {info.wizardFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="block text-small font-semibold text-[var(--color-ink)]">
                      {field.label}
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={fieldValues[field.key] ?? ""}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white text-body font-mono text-sm placeholder:text-[var(--color-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
                    />
                    <p className="text-tiny text-[var(--color-muted)]">{field.hint}</p>
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-danger-light)] text-[var(--color-danger-deep)] text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => setStep("instructions")}
                  className="flex-1 py-2.5 rounded-full border border-[var(--color-border)] text-small font-semibold hover:bg-[var(--color-canvas)] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleVerify}
                  className="flex-1 py-2.5 rounded-full text-small font-bold text-white transition-all hover:-translate-y-px active:scale-[0.98]"
                  style={{ backgroundColor: info.color }}
                >
                  Verify &amp; connect
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Verifying ────────────────────────────────────── */}
          {step === "verifying" && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2
                className="h-8 w-8 animate-spin"
                style={{ color: info.color }}
              />
              <p className="text-body text-[var(--color-ink-mid)]">
                Checking your key with {info.name}…
              </p>
            </div>
          )}

          {/* ── Step 4: Done ─────────────────────────────────────────── */}
          {step === "done" && (
            <>
              <div className="flex flex-col items-center py-6 gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-[var(--color-success-light)] flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-[var(--color-success-deep)]" />
                </div>
                <h3 className="text-card-title font-bold text-[var(--color-ink)]">
                  Connected!
                </h3>
                <p className="text-body text-[var(--color-ink-mid)] max-w-xs leading-relaxed">
                  {accountName
                    ? `You're now connected to ${accountName}.`
                    : `${info.name} is connected.`}{" "}
                  {isLiveMode ? (
                    <span className="font-semibold text-[var(--color-success-deep)]">
                      You&apos;re in live mode — real payments are enabled.
                    </span>
                  ) : (
                    <span className="font-semibold text-[var(--color-warning-deep)]">
                      You&apos;re in test mode — no real money moves until you
                      switch to a live key.
                    </span>
                  )}
                </p>
              </div>

              <button
                onClick={handleDone}
                className="w-full py-3 rounded-full text-small font-bold text-white transition-all hover:-translate-y-px"
                style={{ backgroundColor: info.color }}
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
