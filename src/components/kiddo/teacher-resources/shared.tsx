import { useEffect, useState } from "react";
import { Printer, FolderInput, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listLibrary, addLibraryItem } from "@/lib/teacher-server";

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

export function SaveToLibraryButton({ resourceId, title }: { resourceId: string; title: string }) {
  const [folders, setFolders] = useState<Array<{ id: string; name: string }> | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (open && folders === null) {
      listLibrary()
        .then((r) => setFolders(r.folders.map((f) => ({ id: f.id, name: f.name }))))
        .catch(() => setFolders([]));
    }
  }, [open, folders]);

  const save = async (folderId: string, folderName: string) => {
    setBusy(true);
    try {
      await addLibraryItem({ data: { folderId, kind: "material", title, refId: resourceId } });
      setSavedId(folderId);
      toast.success(`📁 Saved to "${folderName}"`);
      setTimeout(() => setOpen(false), 800);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative print:hidden">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <FolderInput className="size-3.5" /> Save to Library
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-surface p-2 shadow-lg">
          {folders === null ? (
            <p className="p-2 text-xs text-muted">Loading folders…</p>
          ) : folders.length === 0 ? (
            <p className="p-2 text-xs text-muted">No folders yet — create one in the Library.</p>
          ) : (
            folders.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => save(f.id, f.name)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                <span className="truncate">📁 {f.name}</span>
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin text-muted" />
                ) : savedId === f.id ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ResourceShell({
  title,
  subtitle,
  resourceId,
  children,
}: {
  title: string;
  subtitle: string;
  resourceId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          {resourceId && <SaveToLibraryButton resourceId={resourceId} title={title} />}
          <PrintButton />
        </div>
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
