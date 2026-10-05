import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PrintButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="print:hidden"
    >
      <Printer className="size-3.5" /> Print / Save PDF
    </Button>
  );
}

export function ResourceShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <PrintButton />
      </div>
      <div className="print-content space-y-4">{children}</div>
    </div>
  );
}

export function HowToUse({ steps }: { steps: string[] }) {
  return (
    <Card className="p-4">
      <h2 className="font-semibold">How to use this</h2>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    </Card>
  );
}

export function AnswerKey({ items }: { items: Array<[string, string]> }) {
  return (
    <details className="rounded-xl border border-border p-4 print:hidden">
      <summary className="cursor-pointer font-semibold text-sm">
        Answer key (for teacher eyes only)
      </summary>
      <ul className="mt-2 space-y-1 text-sm">
        {items.map(([item, answer]) => (
          <li key={item}>
            <span className="font-medium">{item}</span>
            <span className="text-muted"> → {answer}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
