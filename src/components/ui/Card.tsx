import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds soft hover lift - use for clickable cards. */
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "bg-white rounded-[var(--radius-2xl)] border border-[var(--color-border)] shadow-soft-sm",
        interactive && "transition-all duration-150 hover:shadow-soft hover:-translate-y-px cursor-pointer",
        className,
      )}
      {...rest}
    />
  );
});

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-7 py-5 border-b border-[var(--color-border)]", className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-7", className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-card-title font-semibold text-[var(--color-ink)]", className)}
      {...rest}
    />
  );
}
