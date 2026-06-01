"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "accent" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium " +
  "border transition-[transform,background-color,border-color] duration-100 " +
  "active:translate-y-px disabled:opacity-40 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  default:
    "border-line-strong bg-pane text-fg/90 hover:bg-[#1c222c] hover:border-[#33404f]",
  accent:
    "border-accent-line bg-accent-soft text-accent-strong hover:bg-[rgba(255,180,77,0.22)]",
  danger:
    "border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.12)] text-[#fca5a5] hover:bg-[rgba(248,113,113,0.2)]",
  ghost: "border-transparent text-muted hover:text-fg hover:bg-pane",
};

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "default", ...props },
  ref,
) {
  return (
    <button ref={ref} className={cn(base, variants[variant], className)} {...props} />
  );
});
