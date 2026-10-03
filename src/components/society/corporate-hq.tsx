import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  assignCorporateRole,
  getCorporateStatus,
  getPermissionMatrix,
  listOrgStructure,
  listTeam,
  revokeCorporateRole,
  seedCorporateStructure,
  testCjConnection,
  type CorporateStatus,
  type MatrixRole,
  type OrgDepartment,
  type TeamMember,
} from "@/lib/corporate-server";
import { hasGrant } from "@/lib/corporate-structure";
import { CorporateTower, DepartmentRoom } from "./corporate-tower";

type Tab = "tower" | "org" | "team" | "permissions";

const TABS: { id: Tab; label: string }[] = [
  { id: "tower", label: "🏢 Tower" },
  { id: "org", label: "🌳 Org Chart" },
  { id: "team", label: "👥 Team" },
  { id: "permissions", label: "🔑 Permissions" },
];

export function CorporateHQ() {
  const [status, setStatus] = useState<CorporateStatus | null>(null);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [matrix, setMatrix] = useState<MatrixRole[]>([]);
  const [tab, setTab] = useState<Tab>("tower");
  const [selectedDept, setSelectedDept] = useState<OrgDepartment | null>(null);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await getCorporateStatus();
      setStatus(s);
      if (!s.isCorporate) {
        setDenied(true);
        return;
      }
      if (!s.needsSeed) {
        const [org, team, pm] = await Promise.all([
          listOrgStructure().catch((e) => {
            setLoadError(e instanceof Error ? e.message : "Failed to load organization.");
            return null;
          }),
          listTeam().catch(() => null),
          getPermissionMatrix().catch(() => null),
        ]);
        if (org) {
          setDepartments(org.departments);
          setSelectedDept((prev) => prev ?? org.departments[0] ?? null);
        }
        if (team) setMembers(team.members);
        if (pm) setMatrix(pm.roles);
      }
    } catch {
      setDenied(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const can = useMemo(() => {
    const perms = status?.permissions ?? [];
    return (resource: string, action: string) => hasGrant(perms, resource, action);
  }, [status]);

  if (denied || (status && !status.isCorporate)) {
    return (
      <Card className="p-8 text-center">
        <h2 className="font-display text-xl font-semibold">Corporate HQ is restricted</h2>
        <p className="mt-2 text-sm text-muted">
          This is PillarPath's private office. Only team members with a corporate role can enter.
        </p>
      </Card>
    );
  }

  if (!status) {
    return <p className="py-8 text-center text-sm text-muted">Opening the Tower…</p>;
  }

  // The Tower isn't raised yet — either never initialized, or the structure
  // failed to load. The CEO raises it with one tap (idempotent).
  if (status.needsSeed || departments.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          PillarPath Tower · Corporate Headquarters
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold">
          Welcome{status.displayTitle ? `, ${status.displayTitle}` : ""} 🏢
        </h2>
        <Card className="mt-4 p-8 text-center">
          <h3 className="font-display text-xl font-semibold">🏢 Raise the Tower</h3>
          <p className="mt-2 mx-auto max-w-lg text-sm text-muted">
            {loadError ? (
              <>The organization couldn't be loaded ({loadError}). Re-initializing rebuilds it.</>
            ) : (
              <>The corporate structure hasn't been initialized yet.</>
            )}{" "}
            As Chief Executive Officer, you can raise it now: 10 departments, 33 defined roles,
            and the full permission matrix — all recorded in the audit log.
          </p>
          {status.isCeo ? (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(() => seedCorporateStructure(), "Corporate structure initialized.")
                }
              >
                Initialize corporate structure
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => void load()}>
                Retry loading
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Ask the CEO to initialize the structure.</p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            PillarPath Tower · Corporate Headquarters
          </p>
          <h2 className="mt-1 font-display text-2xl font-bold">
            Welcome{status.displayTitle ? `, ${status.displayTitle}` : ""} 🏢
          </h2>
        </div>
        {can("suppliers", "manage") && (
          <CjTestCard busy={busy} onTest={() => run(() => testCjConnection().then((r) => {
            if (!r.ok) throw new Error(r.message);
            return r;
          }), "CJ connection verified.")} />
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "tower" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <CorporateTower
              departments={departments}
              selected={selectedDept}
              onSelect={setSelectedDept}
            />
            {selectedDept ? (
              <DepartmentRoom dept={selectedDept} />
            ) : (
              <Card className="p-8 text-center text-sm text-muted">
                Select a floor to step inside.
              </Card>
            )}
          </div>
        )}
        {tab === "org" && <OrgChart departments={departments} />}
        {tab === "team" && (
          <TeamManager
            members={members}
            departments={departments}
            isCeo={status.isCeo}
            busy={busy}
            onAssign={(email, roleSlug, note) =>
              run(() => assignCorporateRole({ data: { email, roleSlug, note } }), "Role assigned.")
            }
            onRevoke={(teamId) => run(() => revokeCorporateRole({ data: { teamId } }), "Role revoked.")}
          />
        )}
        {tab === "permissions" && <PermissionMatrix roles={matrix} />}
      </div>
    </div>
  );
}

function CjTestCard({ busy, onTest }: { busy: boolean; onTest: () => void }) {
  return (
    <Card className="flex items-center gap-3 px-4 py-2.5">
      <div className="text-sm">
        <p className="font-semibold">CJ Dropshipping</p>
        <p className="text-xs text-muted">Supplier API connection</p>
      </div>
      <Button size="sm" variant="outline" disabled={busy} onClick={onTest}>
        Test connection
      </Button>
    </Card>
  );
}

function OrgChart({ departments }: { departments: OrgDepartment[] }) {
  const levels = useMemo(() => {
    const byLevel = new Map<number, { title: string; dept: string; members: string[]; level: number }[]>();
    for (const d of departments) {
      for (const r of d.roles) {
        const list = byLevel.get(r.level) ?? [];
        list.push({ title: r.title, dept: d.name, members: r.members.map((m) => m.name), level: r.level });
        byLevel.set(r.level, list);
      }
    }
    return [...byLevel.entries()].sort((a, b) => b[0] - a[0]);
  }, [departments]);

  if (levels.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">No roles defined yet.</p>;
  }

  return (
    <div className="space-y-6">
      {levels.map(([level, roles]) => (
        <div key={level}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
            Level {level}
            {level === 10 ? " · Chief Executive" : level === 9 ? " · C-Suite" : level === 8 ? " · Department Heads" : ""}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r) => (
              <Card key={`${r.dept}-${r.title}`} className="p-3">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-muted">{r.dept}</p>
                {r.members.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.members.map((m) => (
                      <Badge key={m} tone="muted" className="text-[10px]">{m}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] italic text-muted">Open position</p>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamManager({
  members,
  departments,
  isCeo,
  busy,
  onAssign,
  onRevoke,
}: {
  members: TeamMember[];
  departments: OrgDepartment[];
  isCeo: boolean;
  busy: boolean;
  onAssign: (email: string, roleSlug: string, note: string) => void;
  onRevoke: (teamId: number) => void;
}) {
  const [email, setEmail] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [note, setNote] = useState("");

  const roleOptions = useMemo(() => {
    const out: { slug: string; label: string }[] = [];
    for (const d of departments) {
      for (const r of d.roles) {
        out.push({ slug: r.slug, label: `${r.title} · ${d.name} (L${r.level})` });
      }
    }
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [departments]);

  return (
    <div className="space-y-4">
      {isCeo && (
        <Card className="p-4">
          <h3 className="font-display text-base font-semibold">Appoint a team member</h3>
          <p className="mt-1 text-xs text-muted">
            Only the CEO can grant corporate roles. Granting replaces any existing active role and
            is written to the audit log.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="teammate@pillarpath.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select
              value={roleSlug}
              onChange={(e) => setRoleSlug(e.target.value)}
              className="rounded-md border border-white/10 bg-bg px-3 py-2 text-sm"
            >
              <option value="">Select a role…</option>
              {roleOptions.map((o) => (
                <option key={o.slug} value={o.slug}>{o.label}</option>
              ))}
            </select>
          </div>
          <Input
            className="mt-2"
            placeholder="Note (optional) — e.g. starts Monday"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            className="mt-3"
            size="sm"
            disabled={busy || !email.trim() || !roleSlug}
            onClick={() => {
              onAssign(email.trim(), roleSlug, note.trim());
              setEmail("");
              setRoleSlug("");
              setNote("");
            }}
          >
            Grant role
          </Button>
        </Card>
      )}

      <Card className="p-4">
        <h3 className="font-display text-base font-semibold">
          Team directory <span className="text-sm font-normal text-muted">({members.length})</span>
        </h3>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            Just you for now — every great company starts with one believer. 🏛️
          </p>
        ) : (
          <div className="mt-3 divide-y divide-white/10">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold">{m.name}</p>
                  <p className="text-xs text-muted">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs font-medium">{m.roleTitle}</p>
                    <p className="text-[11px] text-muted">{m.departmentName} · L{m.level}</p>
                  </div>
                  {isCeo && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => onRevoke(m.id)}
                      title="Revoke role"
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PermissionMatrix({ roles }: { roles: MatrixRole[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const filtered = roles.filter(
    (r) =>
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.departmentName.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <Card className="p-4">
      <h3 className="font-display text-base font-semibold">Permission matrix</h3>
      <p className="mt-1 text-xs text-muted">
        What each role is allowed to touch. The CEO holds every permission; everyone else holds
        exactly what their seat needs — nothing more.
      </p>
      <Input
        className="mt-3 max-w-xs"
        placeholder="Search roles…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="mt-3 space-y-1.5">
        {filtered.map((r) => {
          const isOpen = open === r.slug;
          return (
            <div key={r.slug} className="rounded-lg border border-white/10">
              <button
                onClick={() => setOpen(isOpen ? null : r.slug)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
              >
                <span className="text-sm">
                  <span className="font-medium">{r.title}</span>
                  <span className="ml-2 text-xs text-muted">{r.departmentName}</span>
                </span>
                <Badge tone="muted" className="text-[10px]">L{r.level}</Badge>
              </button>
              {isOpen && (
                <div className="border-t border-white/10 px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {r.grants.map((g) => (
                      <Badge
                        key={g}
                        tone="muted"
                        className={cn("text-[10px]", g.startsWith("*") && "border-amber-400/40 text-amber-300")}
                      >
                        {g}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-muted">No roles match.</p>
        )}
      </div>
    </Card>
  );
}
