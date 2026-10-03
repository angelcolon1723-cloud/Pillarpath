import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrgDepartment } from "@/lib/corporate-server";

/**
 * PillarPath Tower — the animated corporate headquarters.
 *
 * Ten floors, one per department, rising over a night skyline. Click a floor
 * to step into that department's room: its mandate, its roles, and its people.
 */

const LEVEL_TONE: Record<number, string> = {
  10: "bg-amber-400/20 text-amber-300 border-amber-400/40",
  9: "bg-violet-400/20 text-violet-300 border-violet-400/40",
  8: "bg-cyan-400/20 text-cyan-300 border-cyan-400/40",
};

function levelTone(level: number) {
  return LEVEL_TONE[level] ?? "bg-white/10 text-white/70 border-white/20";
}

export function CorporateTower({
  departments,
  selected,
  onSelect,
}: {
  departments: OrgDepartment[];
  selected: OrgDepartment | null;
  onSelect: (d: OrgDepartment) => void;
}) {
  // Floors run top (executive) to bottom; tower renders bottom-up visually.
  const floors = [...departments].reverse();
  return (
    <div className="tower-sky relative overflow-hidden rounded-2xl border border-white/10">
      <style>{`
        .tower-sky { background: linear-gradient(180deg, #070b1d 0%, #0d1230 55%, #141a3f 100%); }
        @keyframes towerFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes beaconPulse { 0%,100% { opacity: 1; box-shadow: 0 0 18px 4px rgba(34,211,238,.9);} 50% { opacity:.35; box-shadow: 0 0 6px 1px rgba(34,211,238,.4);} }
        @keyframes winTwinkle { 0%,100% { opacity: .9; } 50% { opacity: .25; } }
        @keyframes starTwinkle { 0%,100% { opacity: .8; } 50% { opacity: .15; } }
        .tower-body { animation: towerFloat 7s ease-in-out infinite; }
        .tower-beacon { animation: beaconPulse 2.4s ease-in-out infinite; }
        .tower-win { animation: winTwinkle 3.5s ease-in-out infinite; }
        .tower-star { animation: starTwinkle 4s ease-in-out infinite; }
      `}</style>

      {/* stars */}
      {Array.from({ length: 26 }).map((_, i) => (
        <span
          key={i}
          className="tower-star absolute rounded-full bg-white"
          style={{
            width: 2, height: 2,
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 53 + 7) % 60}%`,
            animationDelay: `${(i % 7) * 0.6}s`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center px-4 pb-8 pt-10">
        {/* antenna + beacon */}
        <div className="flex flex-col items-center">
          <div className="tower-beacon h-3 w-3 rounded-full bg-cyan-300" />
          <div className="h-8 w-1 bg-gradient-to-b from-cyan-200/80 to-slate-500/60" />
        </div>

        {/* building */}
        <div className="tower-body w-full max-w-xs">
          {/* roof sign */}
          <div className="mb-1 text-center">
            <span className="font-display text-sm font-bold tracking-[0.3em] text-cyan-200 drop-shadow-[0_0_12px_rgba(34,211,238,.8)]">
              PILLARPATH
            </span>
          </div>
          <div className="overflow-hidden rounded-t-lg border-x border-t border-cyan-300/30">
            {floors.map((d, i) => {
              const active = selected?.slug === d.slug;
              const lit = (i * 7 + d.slug.length) % 5;
              return (
                <button
                  key={d.slug}
                  onClick={() => onSelect(d)}
                  className={cn(
                    "group relative flex w-full items-center gap-3 border-b border-white/10 px-3 py-2 text-left transition-all",
                    active
                      ? "bg-cyan-400/20 shadow-[inset_0_0_24px_rgba(34,211,238,.25)]"
                      : "bg-white/[0.04] hover:bg-cyan-300/10",
                  )}
                  aria-label={`${d.name} floor`}
                >
                  {/* windows */}
                  <span className="flex flex-1 gap-1">
                    {Array.from({ length: 6 }).map((_, w) => (
                      <span
                        key={w}
                        className={cn(
                          "tower-win h-3 w-3 rounded-[2px]",
                          (w + lit) % 3 === 0 ? "bg-amber-200/90" : "bg-cyan-200/40",
                        )}
                        style={{ animationDelay: `${((w + i) % 5) * 0.7}s` }}
                      />
                    ))}
                  </span>
                  <span className="text-lg" aria-hidden>{d.icon}</span>
                  <span className={cn(
                    "font-display text-xs font-semibold tracking-wide",
                    active ? "text-cyan-100" : "text-white/75 group-hover:text-white",
                  )}>
                    {d.name}
                  </span>
                </button>
              );
            })}
          </div>
          {/* entrance */}
          <div className="rounded-b-lg border-x border-b border-cyan-300/30 bg-gradient-to-b from-white/[0.07] to-white/[0.02] px-3 py-3">
            <div className="mx-auto h-8 w-20 rounded-t-full border border-amber-200/50 bg-amber-200/15 shadow-[0_0_20px_rgba(251,191,36,.35)]" />
            <p className="mt-1 text-center text-[10px] uppercase tracking-[0.25em] text-white/50">
              Lobby · The Society of Becoming
            </p>
          </div>
        </div>

        <p className="mt-4 max-w-sm text-center text-xs text-white/50">
          Ten floors, one mission. Tap a floor to step inside a department.
        </p>
      </div>
    </div>
  );
}

export function DepartmentRoom({ dept }: { dept: OrgDepartment }) {
  const [openRole, setOpenRole] = useState<string | null>(null);
  const totalMembers = dept.roles.reduce((n, r) => n + r.memberCount, 0);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">{dept.room}</p>
          <h3 className="mt-1 font-display text-xl font-bold">
            {dept.icon} {dept.name}
          </h3>
          <p className="mt-1 text-sm text-muted">{dept.mandate}</p>
        </div>
        <Badge tone="muted" className="shrink-0">
          {totalMembers} {totalMembers === 1 ? "member" : "members"}
        </Badge>
      </div>

      <div className="mt-4 space-y-2">
        {dept.roles.map((r) => {
          const open = openRole === r.slug;
          return (
            <div key={r.slug} className="rounded-lg border border-white/10">
              <button
                onClick={() => setOpenRole(open ? null : r.slug)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
              >
                <span>
                  <span className="font-medium text-sm">{r.title}</span>
                  <span className="ml-2 text-xs text-muted">{r.summary}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.memberCount > 0 && (
                    <Badge tone="muted" className="text-[10px]">
                      {r.memberCount}
                    </Badge>
                  )}
                  <Badge className={cn("border text-[10px]", levelTone(r.level))}>
                    L{r.level}
                  </Badge>
                </span>
              </button>
              {open && (
                <div className="border-t border-white/10 px-3 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Responsibilities
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                    {r.responsibilities.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                  {r.members.length > 0 && (
                    <>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-muted">
                        People
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.members.map((m) => (
                          <Badge key={m.email} tone="muted" title={m.email}>
                            {m.name}
                          </Badge>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
