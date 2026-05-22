"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ArrowLeft, ArrowRight, Check, Eye, EyeOff, ExternalLink,
  HelpCircle, Sparkles, BookOpen,
} from "lucide-react";
import { PROVIDER_INFO } from "@/lib/payment-providers";
import { toast } from "@/stores/toastStore";
import type { PaymentProvider } from "@/types";

const PAYMENT_CONNECTED_KEY = "orbit_payment_connected_v1";
const PAYMENT_KEYS_PREFIX = "orbit_payment_keys_";

/** A single question in the wizard. */
interface Step {
  field: string;
  question: string;
  description: string;
  placeholder: string;
  secret: boolean;
  /** Where in the provider dashboard to find this value. Plain English. */
  helpTitle: string;
  helpSteps: string[];
}

const LS_STEPS: Step[] = [
  {
    field: "lemonsqueezy_api_key",
    question: "What's your API key?",
    description:
      "Your API key lets Orbit create payment links in your Lemon Squeezy store. It stays on this device.",
    placeholder: "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
    secret: true,
    helpTitle: "How to find it",
    helpSteps: [
      "Open your Lemon Squeezy dashboard.",
      "Click your profile at the bottom left, then Settings.",
      "Click API in the left menu.",
      "Click Create API key.",
      "Give it a name like 'Orbit' and create.",
      "Copy the long key it shows you (you'll only see it once).",
      "Paste it above.",
    ],
  },
  {
    field: "lemonsqueezy_store_id",
    question: "What's your store ID?",
    description:
      "This is the numeric ID of the store where your payments will land.",
    placeholder: "12345",
    secret: false,
    helpTitle: "How to find it",
    helpSteps: [
      "In your Lemon Squeezy dashboard, click Stores in the left menu.",
      "Click your store name.",
      "Look at the URL in your browser. It will say /stores/12345 — the number at the end is your store ID.",
    ],
  },
  {
    field: "lemonsqueezy_variant_id",
    question: "What's your product variant ID?",
    description:
      "You'll need one 'Pay-what-you-want' product variant. Orbit uses it to create custom-priced payment links.",
    placeholder: "67890",
    secret: false,
    helpTitle: "If you don't have one yet, create it",
    helpSteps: [
      "Go to Products in your store.",
      "Click New product, name it (e.g. 'Invoice payment'), and Save.",
      "In Pricing, choose 'Pay what you want' and set a minimum (e.g. $1).",
      "Publish the product.",
      "Open the product, then click its variant.",
      "The URL ends with /variants/67890 — that number is your variant ID.",
    ],
  },
];

const FW_STEPS: Step[] = [
  {
    field: "flutterwave_secret_key",
    question: "What's your secret key?",
    description:
      "Your secret key lets Orbit create payment links. It stays on this device only.",
    placeholder: "FLWSECK_TEST-xxxxxxxxxxxxxxxx-X",
    secret: true,
    helpTitle: "How to find it",
    helpSteps: [
      "Open your Flutterwave dashboard.",
      "Click Settings in the bottom left.",
      "Click the API tab.",
      "You'll see a Secret Key field. Click the eye icon to reveal it.",
      "Copy the value (starts with FLWSECK_TEST- for testing).",
      "Paste it above.",
    ],
  },
  {
    field: "flutterwave_public_key",
    question: "What's your public key?",
    description:
      "This sits next to your secret key. It's safe to share with the browser.",
    placeholder: "FLWPUBK_TEST-xxxxxxxxxxxxxxxx-X",
    secret: false,
    helpTitle: "How to find it",
    helpSteps: [
      "On the same Settings -> API page in Flutterwave.",
      "Copy the Public Key value (starts with FLWPUBK_TEST- for testing).",
      "Paste it above.",
    ],
  },
];

const STEPS_BY_PROVIDER: Record<PaymentProvider, Step[]> = {
  lemonsqueezy: LS_STEPS,
  flutterwave: FW_STEPS,
};

interface SetupWizardProps {
  open: boolean;
  provider: PaymentProvider | null;
  onClose: () => void;
  onComplete: () => void;
}

export function PaymentSetupWizard({ open, provider, onClose, onComplete }: SetupWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showHelp, setShowHelp] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const steps = provider ? STEPS_BY_PROVIDER[provider] : [];
  const isLast = stepIndex === steps.length - 1;
  const info = provider ? PROVIDER_INFO[provider] : null;
  const currentStep = steps[stepIndex];
  const currentValue = currentStep ? (values[currentStep.field] ?? "").trim() : "";

  // Reset state whenever the wizard re-opens with a new provider
  useEffect(() => {
    if (open && provider) {
      const raw = localStorage.getItem(PAYMENT_KEYS_PREFIX + provider);
      const stored = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      setValues(stored);
      setStepIndex(0);
      setShowHelp(false);
      setShowSuccess(false);
    }
  }, [open, provider]);

  function handleNext() {
    if (!currentStep || !currentValue) return;
    if (isLast) {
      // Persist + announce
      const cleaned: Record<string, string> = {};
      steps.forEach((s) => {
        const v = (values[s.field] ?? "").trim();
        if (v) cleaned[s.field] = v;
      });
      localStorage.setItem(PAYMENT_KEYS_PREFIX + provider, JSON.stringify(cleaned));
      localStorage.setItem(
        PAYMENT_CONNECTED_KEY,
        JSON.stringify({ provider, connectedAt: new Date().toISOString() }),
      );
      setShowSuccess(true);
      toast(`${info?.name} connected`, "success");
    } else {
      setShowHelp(false);
      setStepIndex((i) => i + 1);
    }
  }

  function handleBack() {
    if (stepIndex === 0) return;
    setShowHelp(false);
    setStepIndex((i) => i - 1);
  }

  function handleFinish() {
    setShowSuccess(false);
    onComplete();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && provider && info && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close"
          />

          <motion.div
            className="relative w-full max-w-xl bg-white sm:rounded-[var(--radius-2xl)] rounded-t-[var(--radius-2xl)] shadow-soft-lg flex flex-col max-h-[92vh]"
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {/* Header */}
            <div className="px-6 sm:px-7 pt-6 pb-4 flex items-start justify-between border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${info.color}18` }}
                >
                  <Sparkles className="h-5 w-5" style={{ color: info.color }} />
                </div>
                <div className="min-w-0">
                  <div className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)]">
                    {showSuccess
                      ? "All done"
                      : `Step ${stepIndex + 1} of ${steps.length}`}
                  </div>
                  <h2 className="text-card-title font-bold text-[var(--color-ink)] truncate">
                    Connect {info.name}
                  </h2>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-[var(--color-border-light)]"
                aria-label="Close"
              >
                <X className="h-4 w-4 text-[var(--color-muted)]" />
              </button>
            </div>

            {/* Progress bar */}
            {!showSuccess && (
              <div className="px-6 sm:px-7 pt-4">
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className="h-1.5 flex-1 rounded-full transition-colors"
                      style={{
                        backgroundColor:
                          i <= stepIndex ? info.color : "var(--color-border)",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto min-h-0">
              <AnimatePresence mode="wait">
                {showSuccess ? (
                  <SuccessStep
                    key="success"
                    providerName={info.name}
                    onFinish={handleFinish}
                  />
                ) : currentStep ? (
                  <StepBody
                    key={`step-${stepIndex}`}
                    step={currentStep}
                    value={values[currentStep.field] ?? ""}
                    onChange={(v) =>
                      setValues((vals) => ({ ...vals, [currentStep.field]: v }))
                    }
                    showHelp={showHelp}
                    onToggleHelp={() => setShowHelp((s) => !s)}
                    accentColor={info.color}
                    dashboardUrl={info.dashboardUrl}
                  />
                ) : null}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {!showSuccess && (
              <div className="border-t border-[var(--color-border)] px-6 sm:px-7 py-4 flex items-center justify-between gap-3">
                <button
                  onClick={handleBack}
                  disabled={stepIndex === 0}
                  className="inline-flex items-center gap-1.5 text-small font-semibold text-[var(--color-ink-light)] hover:text-[var(--color-ink)] disabled:opacity-0 transition-opacity"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>

                <Link
                  href="/help#payments"
                  target="_blank"
                  className="hidden sm:inline-flex items-center gap-1.5 text-tiny font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  View full guide
                </Link>

                <button
                  onClick={handleNext}
                  disabled={!currentValue}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-small font-bold text-white shadow-soft transition-all hover:-translate-y-px active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                  style={{ backgroundColor: info.color }}
                >
                  {isLast ? "Finish" : "Next"}
                  {!isLast && <ArrowRight className="h-4 w-4" />}
                  {isLast && <Check className="h-4 w-4" />}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Per-step body. Question + input + optional "where to find" panel ──────

function StepBody({
  step, value, onChange, showHelp, onToggleHelp, accentColor, dashboardUrl,
}: {
  step: Step;
  value: string;
  onChange: (v: string) => void;
  showHelp: boolean;
  onToggleHelp: () => void;
  accentColor: string;
  dashboardUrl: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.18 }}
      className="px-6 sm:px-7 py-7"
    >
      {/* Illustration / accent block */}
      <div
        className="w-full h-32 rounded-[var(--radius-xl)] mb-6 flex items-center justify-center"
        style={{ backgroundColor: `${accentColor}12` }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-section font-bold"
          style={{ backgroundColor: accentColor }}
        >
          {/* show the field number as a friendly cue */}
          {step.field.includes("api") ? "🔑" : step.field.includes("store") ? "🏪" : step.field.includes("variant") ? "📦" : step.field.includes("secret") ? "🔐" : step.field.includes("public") ? "🔓" : "🔑"}
        </div>
      </div>

      <h3 className="text-section font-bold tracking-tight">{step.question}</h3>
      <p className="mt-2 text-body text-[var(--color-ink-light)] leading-relaxed">
        {step.description}
      </p>

      {/* Input */}
      <div className="mt-6 relative">
        <input
          type={step.secret && !revealed ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={step.placeholder}
          className="w-full h-13 px-5 pr-12 rounded-full bg-[var(--color-canvas)] border-2 border-[var(--color-border)] text-body font-mono text-[var(--color-ink)] placeholder:text-[var(--color-muted)] placeholder:font-sans focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition-colors"
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
        {step.secret && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            tabIndex={-1}
            aria-label={revealed ? "Hide value" : "Show value"}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>

      {/* "Where do I find this?" expandable hint */}
      <div className="mt-4">
        <button
          onClick={onToggleHelp}
          className="inline-flex items-center gap-1.5 text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
          aria-expanded={showHelp}
        >
          <HelpCircle className="h-4 w-4" />
          {showHelp ? "Hide" : "Where do I find this?"}
        </button>

        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-5 rounded-[var(--radius-lg)] bg-[var(--color-canvas)] border border-[var(--color-border)]">
                <div className="text-tiny font-bold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                  {step.helpTitle}
                </div>
                <ol className="space-y-2.5">
                  {step.helpSteps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-[var(--color-border)] text-tiny font-bold flex items-center justify-center"
                        style={{ color: accentColor }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-small text-[var(--color-ink-mid)] leading-relaxed pt-0.5">
                        {s}
                      </span>
                    </li>
                  ))}
                </ol>
                <a
                  href={dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-tiny font-semibold bg-white border border-[var(--color-border)] hover:border-[var(--color-primary)]/40"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open dashboard
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function SuccessStep({ providerName, onFinish }: { providerName: string; onFinish: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="px-6 sm:px-10 py-10 text-center"
    >
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 18, delay: 0.1 }}
        className="w-20 h-20 rounded-full bg-[var(--color-success)] flex items-center justify-center mx-auto mb-6"
      >
        <Check className="h-10 w-10 text-white" strokeWidth={3} />
      </motion.div>

      <h3 className="text-section font-bold tracking-tight">{providerName} is connected</h3>
      <p className="mt-3 text-body text-[var(--color-ink-light)] leading-relaxed max-w-md mx-auto">
        Now when you open any invoice, you can generate a payment link for your client
        to pay. Money goes straight into your {providerName} account.
      </p>

      <div className="mt-7 flex flex-col items-center gap-2">
        <button
          onClick={onFinish}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-body font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)] shadow-soft"
        >
          Done
        </button>
        <Link
          href="/help#payments"
          className="text-small font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] mt-1"
        >
          Read the full guide
        </Link>
      </div>
    </motion.div>
  );
}
