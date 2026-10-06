import { useEffect, useState } from "react";
import {
  FolderOpen,
  Folder,
  Plus,
  Pencil,
  Trash2,
  StickyNote,
  Library as LibraryIcon,
  Link2,
  ChevronRight,
  Loader2,
  X,
  Upload,
  FileText,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  listLibrary,
  createFolder,
  renameFolder,
  deleteFolder,
  addLibraryItem,
  removeLibraryItem,
  getFileUploadUrl,
  confirmFileUpload,
  listLibraryFiles,
  getFileDownloadUrl,
  deleteLibraryFile,
  type LibraryFolder,
  type LibraryItem,
  type LibraryFile,
} from "@/lib/teacher-server";
import { SectionHeader } from "./teacher-views";

function itemIcon(kind: LibraryItem["kind"]) {
  if (kind === "material") return LibraryIcon;
  if (kind === "link") return Link2;
  return StickyNote;
}

export function TeacherLibrary({ onOpenMaterial }: { onOpenMaterial: (resourceId: string) => void }) {
  const [folders, setFolders] = useState<LibraryFolder[] | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<LibraryFile[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [r2Missing, setR2Missing] = useState(false);

  const load = async () => {
    try {
      const r = await listLibrary();
      setFolders(r.folders);
    } catch {
      setFolders([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!openFolderId) {
      setFiles(null);
      return;
    }
    listLibraryFiles({ data: { folderId: openFolderId } })
      .then((r) => setFiles(r.files))
      .catch(() => setFiles([]));
  }, [openFolderId, folders]);

  const openFolder = folders?.find((f) => f.id === openFolderId) ?? null;

  const doCreateFolder = async () => {
    if (!newFolderName.trim()) return toast.error("Name the folder first.");
    setBusy(true);
    try {
      const r = await createFolder({ data: { name: newFolderName.trim() } });
      setNewFolderName("");
      setShowNewFolder(false);
      await load();
      setOpenFolderId(r.id);
      toast.success("📁 Folder created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't create folder.");
    } finally {
      setBusy(false);
    }
  };

  const doRename = async (id: string) => {
    if (!renameValue.trim()) return;
    setBusy(true);
    try {
      await renameFolder({ data: { id, name: renameValue.trim() } });
      setRenamingId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rename.");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}" and everything in it?`)) return;
    setBusy(true);
    try {
      await deleteFolder({ data: { id } });
      if (openFolderId === id) setOpenFolderId(null);
      await load();
      toast.success("Folder deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    } finally {
      setBusy(false);
    }
  };

  const doAddNote = async () => {
    if (!openFolderId || !noteTitle.trim()) return toast.error("Give the note a title.");
    setBusy(true);
    try {
      await addLibraryItem({
        data: { folderId: openFolderId, kind: "note", title: noteTitle.trim(), body: noteBody.trim() || undefined },
      });
      setNoteTitle("");
      setNoteBody("");
      setShowNoteForm(false);
      await load();
      toast.success("📝 Note saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save note.");
    } finally {
      setBusy(false);
    }
  };

  const doRemoveItem = async (id: string) => {
    setBusy(true);
    try {
      await removeLibraryItem({ data: { id } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove.");
    } finally {
      setBusy(false);
    }
  };

  const openItem = (item: LibraryItem) => {
    if (item.kind === "material" && item.refId) {
      onOpenMaterial(item.refId);
      return;
    }
    if (item.kind === "link") {
      const url = (item.body ?? item.refId ?? "").trim();
      if (/^https?:\/\//i.test(url)) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      toast.message("This link has no URL saved.");
      return;
    }
    // Notes open inline via the note viewer below.
  };

  const uploadFile = async (file: File) => {
    if (!openFolderId) return;
    setUploading(true);
    try {
      const { uploadUrl, fileKey } = await getFileUploadUrl({
        data: {
          folderId: openFolderId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        },
      });
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload failed — try again.");
      await confirmFileUpload({
        data: {
          folderId: openFolderId,
          fileKey,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        },
      });
      const r = await listLibraryFiles({ data: { folderId: openFolderId } });
      setFiles(r.files);
      setR2Missing(false);
      toast.success(`📄 ${file.name} uploaded`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed.";
      if (/aren't set up|isn't connected/i.test(msg)) setR2Missing(true);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (file: LibraryFile) => {
    try {
      const r = await getFileDownloadUrl({ data: { fileId: file.id } });
      const a = document.createElement("a");
      a.href = r.url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't download.");
    }
  };

  const deleteFile = async (file: LibraryFile) => {
    if (!confirm(`Delete "${file.fileName}"?`)) return;
    try {
      await deleteLibraryFile({ data: { fileId: file.id } });
      setFiles((f) => (f ?? []).filter((x) => x.id !== file.id));
      toast.success("File deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete.");
    }
  };

  const fmtSize = (b: number) =>
    b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

  /* ---------------- folder detail ---------------- */
  if (openFolder) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setOpenFolderId(null)}
          className="text-sm font-semibold text-accent hover:underline"
        >
          ← All folders
        </button>
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <FolderOpen className="size-6 text-accent" />
            {openFolder.name}
          </h1>
          <span className="text-xs text-muted">
            {openFolder.items.length} item{openFolder.items.length === 1 ? "" : "s"}
          </span>
        </div>

        {openFolder.items.length === 0 && !showNoteForm && (
          <Card className="p-6 text-center">
            <p className="text-3xl">📁</p>
            <p className="mt-2 font-semibold">Empty folder</p>
            <p className="mt-1 text-xs text-muted">
              Save teaching materials here, or jot a note.
            </p>
          </Card>
        )}

        <div className="grid gap-2">
          {openFolder.items.map((item) => {
            const Icon = itemIcon(item.kind);
            const clickable = item.kind === "material" || item.kind === "link";
            return (
              <Card key={item.id} className="flex items-start gap-3 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-4" />
                </span>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => openItem(item)}
                  className={cn("min-w-0 flex-1 text-left", clickable && "hover:underline")}
                >
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  {item.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.body}</p>}
                  {item.kind === "material" && (
                    <p className="mt-0.5 text-xs font-medium text-accent">Open material →</p>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => doRemoveItem(item.id)}
                  disabled={busy}
                  className="shrink-0 rounded-xl p-1.5 text-muted shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95 hover:bg-surface-2 hover:text-ink"
                  aria-label="Remove item"
                >
                  <X className="size-4" />
                </button>
              </Card>
            );
          })}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">📄 Files</p>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload file"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadFile(f);
                }}
              />
            </label>
          </div>
          {r2Missing && (
            <div className="rounded-xl bg-amber-500/10 p-3 text-xs">
              <span className="font-semibold">File storage isn't connected yet.</span>{" "}
              Your admin needs to connect a Cloudflare R2 bucket (free tier) — then uploads light up here.
            </div>
          )}
          {files === null && !r2Missing && (
            <p className="text-xs text-muted">Loading files…</p>
          )}
          {files !== null && files.length === 0 && !r2Missing && (
            <p className="text-xs text-muted">
              No files yet — upload worksheets, PDFs, or photos of student work.
            </p>
          )}
          {files?.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.fileName}</p>
                <p className="text-xs text-muted">{fmtSize(f.sizeBytes)}</p>
              </div>
              <button
                type="button"
                onClick={() => downloadFile(f)}
                className="rounded-xl p-1.5 text-muted shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95 hover:bg-surface-2 hover:text-ink"
                aria-label="Download"
              >
                <Download className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteFile(f)}
                className="rounded-xl p-1.5 text-muted shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95 hover:bg-surface-2 hover:text-red-500"
                aria-label="Delete file"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>

        {!showNoteForm ? (
          <Button variant="outline" size="sm" onClick={() => setShowNoteForm(true)}>
            <StickyNote className="size-3.5" /> Add a note
          </Button>
        ) : (
          <Card className="space-y-2 p-4">
            <Input
              placeholder="Note title"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              maxLength={80}
            />
            <textarea
              placeholder="Write anything — lesson ideas, observations, reminders…"
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface p-3 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={doAddNote} disabled={busy}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Save note"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNoteForm(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  /* ---------------- folder grid ---------------- */
  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Library"
        title="My teaching library"
        text="Folders for your materials, notes, and everything you want to keep close — your classroom filing cabinet."
      />
      <div className="flex justify-end">
        {!showNewFolder ? (
          <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)}>
            <Plus className="size-3.5" /> New folder
          </Button>
        ) : (
          <div className="flex w-full max-w-sm gap-2">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              maxLength={40}
              onKeyDown={(e) => e.key === "Enter" && doCreateFolder()}
            />
            <Button size="sm" onClick={doCreateFolder} disabled={busy}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : "Create"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}>
              <X className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {folders === null && <p className="text-sm text-muted">Loading library…</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {folders?.map((f) => (
          <Card key={f.id} className="group p-4">
            {renamingId === f.id ? (
              <div className="flex gap-2">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={40}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") doRename(f.id);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  autoFocus
                />
                <Button size="sm" onClick={() => doRename(f.id)} disabled={busy}>
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpenFolderId(f.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <Folder className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{f.name}</span>
                    <span className="text-xs text-muted">
                      {f.items.length} item{f.items.length === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted" />
                </button>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => {
                      setRenamingId(f.id);
                      setRenameValue(f.name);
                    }}
                    className="rounded-xl p-1.5 text-muted shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95 hover:bg-surface-2 hover:text-ink"
                    aria-label="Rename folder"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => doDelete(f.id, f.name)}
                    className="rounded-xl p-1.5 text-muted shadow-[var(--shadow-float)] transition-all duration-150 active:scale-95 hover:bg-surface-2 hover:text-red-500"
                    aria-label="Delete folder"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {folders !== null && folders.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-3xl">📁</p>
          <p className="mt-2 font-semibold">No folders yet</p>
          <p className="mt-1 text-xs text-muted">Create your first folder to start organizing.</p>
        </Card>
      )}
    </div>
  );
}
