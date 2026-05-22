import type { ReactNode } from "react";

export type LegalNode =
  | { type: "p"; text: string }
  | { type: "ul"; items: (string | { bold: string; text: string })[] }
  | { type: "email"; address: string }
  | { type: "note"; text: string };

export interface LegalSection {
  title: string;
  body: LegalNode[];
}

interface LegalDocProps {
  title: string;
  lastUpdated: string;
  intro?: string;
  sections: LegalSection[];
}

export function LegalDoc({ title, lastUpdated, intro, sections }: LegalDocProps) {
  return (
    <article className="space-y-8">
      <header>
        <h1 className="text-page font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-small text-[var(--color-muted)]">
          Last updated · {lastUpdated}
        </p>
        {intro && (
          <p className="mt-5 text-lead text-[var(--color-ink-mid)] leading-relaxed">{intro}</p>
        )}
      </header>

      {sections.map((section, i) => (
        <section key={i} className="space-y-3">
          <h2 className="text-card-title font-semibold pb-2 border-b border-[var(--color-border)]">
            {section.title}
          </h2>
          {section.body.map((node, j) => (
            <NodeRenderer key={j} node={node} />
          ))}
        </section>
      ))}

      <aside className="flex items-start gap-3 px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-warning-light)] text-[var(--color-warning-deep)]">
        <span className="text-small leading-relaxed">
          <strong className="font-bold">Legal disclaimer:</strong> For informational purposes only - not legal advice. Consult a qualified attorney for your specific requirements.
        </span>
      </aside>
    </article>
  );
}

function NodeRenderer({ node }: { node: LegalNode }) {
  switch (node.type) {
    case "p":
      return (
        <p className="text-body text-[var(--color-ink-mid)] leading-relaxed">{node.text}</p>
      );

    case "ul":
      return (
        <ul className="space-y-2 pl-1">
          {node.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-body text-[var(--color-ink-mid)] leading-relaxed">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] flex-shrink-0" />
              <span>
                {typeof item === "string" ? (
                  item
                ) : (
                  <>
                    <strong className="font-semibold text-[var(--color-ink)]">{item.bold}</strong>{" "}
                    {item.text}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      );

    case "email":
      return (
        <a
          href={`mailto:${node.address}`}
          className="inline-block text-body text-[var(--color-primary)] font-semibold hover:text-[var(--color-primary-dark)]"
        >
          {node.address}
        </a>
      );

    case "note":
      return (
        <NoteBlock>{node.text}</NoteBlock>
      );
  }
}

function NoteBlock({ children }: { children: ReactNode }) {
  return (
    <div className="px-5 py-4 rounded-[var(--radius-lg)] bg-[var(--color-primary-subtle)] border-l-4 border-[var(--color-primary)] text-body text-[var(--color-ink-mid)] leading-relaxed">
      {children}
    </div>
  );
}
