import { cn } from "@/lib/cn";

export function Panel({
  className, children,
}: {
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col rounded-lg border border-line bg-panel", className)}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title, right, className,
}: {
  title: string; right?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center justify-between border-b border-line px-3 py-2", className)}>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted">
        {title}
      </span>
      {right}
    </div>
  );
}
