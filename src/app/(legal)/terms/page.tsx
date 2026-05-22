import type { Metadata } from "next";
import { LegalDoc, type LegalSection } from "@/components/legal/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Service · Orbit",
  description: "The terms under which you use Orbit.",
};

const SECTIONS: LegalSection[] = [
  {
    title: "Acceptance of Terms",
    body: [
      {
        type: "p",
        text:
          'By accessing or using Orbit (the "Service") operated by Orbit ("we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.',
      },
    ],
  },
  {
    title: "Description of Service",
    body: [
      {
        type: "p",
        text:
          "Orbit provides client management, booking, invoicing, payment tracking, and business tools for small service businesses. The Service is available on a Free plan and a paid Pro plan. We reserve the right to modify, suspend, or discontinue any part of the Service at any time, with or without notice.",
      },
    ],
  },
  {
    title: "User Accounts",
    body: [
      {
        type: "p",
        text: "When you create an account, you must provide accurate, complete, and current information. You are responsible for:",
      },
      {
        type: "ul",
        items: [
          "Maintaining the confidentiality of your account credentials",
          "All activities that occur under your account",
          "Notifying us immediately of any unauthorized use of your account",
        ],
      },
      { type: "p", text: "We reserve the right to terminate accounts that violate these Terms." },
    ],
  },
  {
    title: "Age Requirements",
    body: [
      {
        type: "p",
        text:
          "You must be at least 13 years old to use this Service. By using the Service, you represent that you meet this age requirement. If we become aware that a user does not meet this requirement, we will terminate their account.",
      },
    ],
  },
  {
    title: "Intellectual Property",
    body: [
      {
        type: "p",
        text:
          "The Service and its original content, features, and functionality are and will remain the exclusive property of Orbit and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without prior written consent.",
      },
      {
        type: "p",
        text:
          "Content you create within the Service - clients, bookings, invoices, notes, and similar - remains your property. You grant Orbit a limited, non-exclusive license to store, process, and display that content solely to operate the Service for you.",
      },
    ],
  },
  {
    title: "Prohibited Uses",
    body: [
      { type: "p", text: "You agree not to use the Service:" },
      {
        type: "ul",
        items: [
          "In any way that violates applicable laws or regulations",
          "To transmit unsolicited commercial communications (spam)",
          "To impersonate any person or entity",
          "To engage in any conduct that restricts or inhibits others' use of the Service",
          "To attempt to gain unauthorized access to any part of the Service",
          "To use automated scripts to collect information from or interact with the Service",
          "To upload or transmit viruses or other malicious code",
        ],
      },
    ],
  },
  {
    title: "Payment Terms",
    body: [
      {
        type: "p",
        text:
          "The Free plan is available at no cost. If you subscribe to the Pro plan, the following terms apply:",
      },
      {
        type: "ul",
        items: [
          "Fees are billed in advance on a recurring basis (monthly or yearly)",
          "All fees are non-refundable unless required by law",
          "We may change pricing with 30 days' notice",
          "Failure to pay may result in downgrade to the Free plan or suspension of features",
        ],
      },
      {
        type: "p",
        text:
          "Payment processing is handled by third-party providers (such as Paystack, Stripe, or Flutterwave). Their terms also apply to those transactions.",
      },
    ],
  },
  {
    title: "Disclaimer of Warranties",
    body: [
      {
        type: "p",
        text:
          'The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. Orbit expressly disclaims all warranties, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.',
      },
      {
        type: "p",
        text:
          "We do not warrant that (a) the Service will function uninterrupted or error-free, (b) defects will be corrected, or (c) the Service is free of viruses or other harmful components.",
      },
    ],
  },
  {
    title: "Limitation of Liability",
    body: [
      {
        type: "p",
        text:
          "To the maximum extent permitted by applicable law, Orbit shall not be liable for any indirect, incidental, special, consequential, or punitive damages - including loss of profits, data, goodwill, or other intangible losses - resulting from your use of or inability to use the Service.",
      },
      {
        type: "p",
        text:
          "In no event shall Orbit's total liability to you exceed the greater of one hundred dollars ($100) or the amounts paid by you to Orbit in the past twelve months.",
      },
    ],
  },
  {
    title: "Governing Law",
    body: [
      {
        type: "p",
        text:
          "These Terms shall be governed and construed in accordance with the laws of Nigeria, without regard to its conflict of law provisions.",
      },
      {
        type: "p",
        text:
          "Any disputes arising under these Terms will be resolved through binding arbitration in Nigeria, except that either party may seek injunctive relief in any court of competent jurisdiction.",
      },
    ],
  },
  {
    title: "Changes to Terms",
    body: [
      {
        type: "p",
        text:
          'We may modify these Terms at any time. We will notify users of material changes by posting the updated Terms with a new effective date. Your continued use of the Service after changes are posted constitutes acceptance of the revised Terms.',
      },
    ],
  },
  {
    title: "Contact Us",
    body: [
      { type: "p", text: "If you have questions about these Terms, please contact us at:" },
      { type: "email", address: "ifeoluwaadegbulugbe@gmail.com" },
    ],
  },
];

export default function TermsPage() {
  return <LegalDoc title="Terms of Service" lastUpdated="May 13, 2026" sections={SECTIONS} />;
}
