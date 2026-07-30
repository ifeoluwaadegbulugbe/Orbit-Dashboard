import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy · Orbit",
  description: "How Orbit handles your personal information.",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Introduction",
    body: [
      {
        type: "p",
        text:
          'This Privacy Policy describes how Orbit ("we," "us," or "our") collects, uses, and shares information about you when you use the Orbit web app and mobile app (the "Service").',
      },
      {
        type: "p",
        text:
          "By using our Service, you agree to the collection and use of information in accordance with this policy. This policy applies to all users who access or use the Service.",
      },
    ],
  },
  {
    title: "Information We Collect",
    body: [
      { type: "p", text: "We collect several types of information in connection with the Service:" },
      {
        type: "ul",
        items: [
          {
            bold: "Information you provide directly:",
            text:
              "name, email address, business name, business type, profile picture, and any client, booking, invoice, or note data you enter into Orbit.",
          },
          {
            bold: "Information collected automatically:",
            text:
              "device information, IP address, browser type, app version, operating system, crash reports, and basic usage analytics.",
          },
          {
            bold: "Information from third-party services:",
            text:
              "when you connect a payment provider (such as Paystack, Stripe, or Flutterwave), we may receive transaction status, settlement details, and a verification reference - but never card numbers or banking credentials.",
          },
        ],
      },
    ],
  },
  {
    title: "How We Use Your Information",
    body: [
      { type: "p", text: "We use the information we collect to:" },
      {
        type: "ul",
        items: [
          "Provide, operate, and maintain the Service",
          "Personalize your experience and remember your preferences",
          "Understand how the Service is used so we can improve it",
          "Communicate with you for support and important account notices",
          "Process transactions and send related receipts or reminders",
          "Send technical notices, updates, and security alerts",
          "Comply with legal obligations",
        ],
      },
    ],
  },
  {
    title: "How We Share Your Information",
    body: [
      { type: "p", text: "We may share your information in the following limited circumstances:" },
      {
        type: "ul",
        items: [
          {
            bold: "Service providers:",
            text:
              "we share information with vendors that operate parts of the Service for us - including Supabase (database and authentication) and payment providers (Paystack, Stripe, Flutterwave).",
          },
          {
            bold: "Legal requirements:",
            text: "we may disclose information if required by law or valid legal process.",
          },
          {
            bold: "Business transfers:",
            text: "we may share information in connection with a merger, acquisition, or sale of assets.",
          },
        ],
      },
      {
        type: "p",
        text:
          "We do not sell your personal information, and we do not share it with third parties for their own marketing purposes.",
      },
    ],
  },
  {
    title: "Your Data, Your Property",
    body: [
      {
        type: "note",
        text:
          "Client lists, bookings, notes, and invoices you create in Orbit are yours. You can export them at any time from the Profile screen, and you can request full deletion of your account and data by contacting us.",
      },
    ],
  },
  {
    title: "Cookies and Tracking",
    body: [
      {
        type: "p",
        text:
          "We use cookies and similar tracking technologies to keep you signed in, remember preferences, and analyze usage of the Service. You can instruct your browser to refuse cookies, but parts of the Service may not function as expected without them.",
      },
      {
        type: "p",
        text:
          "Third-party services we integrate with - such as payment processors - may set their own cookies on their hosted payment pages.",
      },
    ],
  },
  {
    title: "Data Retention",
    body: [
      {
        type: "p",
        text:
          "We retain your personal information for as long as your account is active or as needed to provide the Service. If you delete your account, we will delete or anonymize your data within 30 days, except where we are required to keep it longer for legal or accounting reasons.",
      },
    ],
  },
  {
    title: "Your Rights Under the GDPR",
    body: [
      {
        type: "p",
        text:
          "If you are located in the European Economic Area, you have the following rights regarding your personal data:",
      },
      {
        type: "ul",
        items: [
          { bold: "Right of access:", text: "request a copy of the personal data we hold about you." },
          { bold: "Right to rectification:", text: "ask us to correct inaccurate or incomplete information." },
          { bold: "Right to erasure:", text: "ask us to delete your personal data in certain circumstances." },
          { bold: "Right to restriction:", text: "ask us to limit how we use your data." },
          { bold: "Right to data portability:", text: "request your data in a machine-readable format." },
          { bold: "Right to object:", text: "object to our processing of your data based on legitimate interests." },
        ],
      },
      {
        type: "p",
        text:
          "To exercise any of these rights, please contact us at the email below. We will respond within 30 days.",
      },
      { type: "email", address: "getorbitcrm@gmail.com" },
      {
        type: "p",
        text:
          "Lawful basis for processing: we process your personal data on the basis of consent, contract performance, legitimate interests, and legal obligations as applicable.",
      },
    ],
  },
  {
    title: "Children's Privacy",
    body: [
      {
        type: "p",
        text:
          "Our Service is not directed to children under 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will delete it promptly.",
      },
      {
        type: "p",
        text:
          "If you are a parent or guardian and believe your child has provided us with personal information, please contact us.",
      },
    ],
  },
  {
    title: "Data Security",
    body: [
      {
        type: "p",
        text:
          "We implement appropriate technical and organizational measures to protect your information against accidental or unlawful destruction, loss, alteration, or unauthorized disclosure. Passwords are hashed, traffic is encrypted in transit, and access to production data is restricted.",
      },
      {
        type: "p",
        text:
          "No method of transmission or electronic storage is 100% secure, however, so we cannot guarantee absolute security.",
      },
    ],
  },
  {
    title: "Third-Party Links",
    body: [
      {
        type: "p",
        text:
          "Our Service may contain links to third-party websites. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.",
      },
    ],
  },
  {
    title: "Changes to This Privacy Policy",
    body: [
      {
        type: "p",
        text:
          'We may update this Privacy Policy from time to time. We will notify you of changes by posting the new policy and updating the "Last updated" date.',
      },
    ],
  },
  {
    title: "Contact Us",
    body: [
      { type: "p", text: "If you have questions about this Privacy Policy, please contact us:" },
      { type: "email", address: "getorbitcrm@gmail.com" },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      lastUpdated="May 13, 2026"
      intro="Your business data is yours. This policy explains what we collect, how we use it, and your rights."
      sections={SECTIONS}
    />
  );
}
