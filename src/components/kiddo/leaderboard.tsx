import { useMemo } from "react";
import { Medal, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSocial } from "@/store/social";
import {
  useTeacher,
  type TeacherAssignment,
  type TeacherClassroom,
  type TeacherStudent,
  type TeacherSubmission,
} from "@/store/teacher";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Effort ranking                                                        */
/*                                                                      */
/* Leaderboards rank EFFORT — completed assignments and participation —  */
/* never Unit balances. This keeps competition healthy and avoids        */
/* shaming kids who earn less.                                           */
/* ------------------------------------------------------------------ */

export type EffortRow = {
  studentId: string;
  studentName: string;
  completed: number;
  submitted: number;
  score: number;
};

export function effortRanking(
  classroomId: string,
  students: TeacherStudent[],
  submissions: TeacherSubmission[],
  assignments: TeacherAssignment[],
): EffortRow[] {
  const roster = students.filter((s) => s.classroomId === classroomId);
  const classAssignmentIds = new Set(
    assignments.filter((a) => a.classroomId === classroomId).map((a) => a.id),
  );
  return roster
    .map((student) => {
      const mine = submissions.filter(
        (sub) =>
          sub.studentId === student.id && classAssignmentIds.has(sub.assignmentId),
      );
      const completed = mine.filter((sub) => sub.status === "complete").length;
      const submitted = mine.length;
      return {
        studentId: student.id,
        studentName: student.name,
        completed,
        submitted,
        score: completed * 10 + submitted,
      };
    })
    .sort((a, b) => b.score - a.score || a.studentName.localeCompare(b.studentName));
}

function rankMedal(rank: number) {
  if (rank === 1) return <Medal className="size-5 text-amber-500" />;
  if (rank === 2) return <Medal className="size-5 text-slate-400" />;
  if (rank === 3) return <Medal className="size-5 text-amber-700" />;
  return (
    <span className="grid size-5 place-items-center text-xs font-bold text-muted tabular-nums">
      {rank}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher view: full class ranking + opt-in controls                   */
/* ------------------------------------------------------------------ */

export function TeacherLeaderboard({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const students = useTeacher((s) => s.students);
  const submissions = useTeacher((s) => s.submissions);
  const assignments = useTeacher((s) => s.assignments);
  const configs = useSocial((s) => s.leaderboardConfigs);
  const optIns = useSocial((s) => s.leaderboardOptIns);
  const setLeaderboardEnabled = useSocial((s) => s.setLeaderboardEnabled);
  const setLeaderboardNamedMode = useSocial((s) => s.setLeaderboardNamedMode);

  const classroomId = activeClassroom?.id ?? "";
  const config = useMemo(
    () =>
      configs.find((c) => c.classroomId === classroomId) ?? {
        enabled: false,
        namedMode: false,
      },
    [configs, classroomId],
  );

  const rows = useMemo(
    () => (classroomId ? effortRanking(classroomId, students, submissions, assignments) : []),
    [classroomId, students, submissions, assignments],
  );

  const optedInRows = useMemo(
    () =>
      rows.filter((r) =>
        optIns.some(
          (o) =>
            o.classroomId === classroomId &&
            o.studentName.trim().toLowerCase() === r.studentName.trim().toLowerCase() &&
            o.optedIn,
        ),
      ),
    [rows, optIns, classroomId],
  );

  if (!activeClassroom) {
    return (
      <div className="space-y-5">
        <Card className="p-5">
          <CardTitle>Leaderboard</CardTitle>
          <CardHint>Create a classroom first.</CardHint>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Trophy className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Class leaderboard</CardTitle>
            <CardHint>
              Effort only — completed assignments and participation. Unit balances
              are never ranked.
            </CardHint>
          </div>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm font-medium">
          <span>Leaderboard on for {activeClassroom.name}</span>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => {
              setLeaderboardEnabled(classroomId, e.target.checked);
              toast.message(
                e.target.checked ? "Leaderboard is live" : "Leaderboard is off",
              );
            }}
            className="size-4 accent-accent"
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm font-medium">
          <span>
            Show student names to the class
            <span className="block text-xs font-normal text-muted">
              Off = children see “You are #3 of 12” with anonymized peers
            </span>
          </span>
          <input
            type="checkbox"
            checked={config.namedMode}
            onChange={(e) => setLeaderboardNamedMode(classroomId, e.target.checked)}
            className="size-4 accent-accent"
          />
        </label>
        <p className="text-xs text-muted">
          {optedInRows.length} of {rows.length} students opted in. Parents opt their
          child in from the Teachers section — it is off by default.
        </p>
      </Card>

      {config.enabled ? (
        <Card className="p-4">
          <CardTitle className="text-base">Rankings</CardTitle>
          {optedInRows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              No students opted in yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {optedInRows.map((row, i) => (
                <li key={row.studentId} className="flex items-center gap-3 py-3">
                  {rankMedal(i + 1)}
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {row.studentName}
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {row.completed} done · {row.submitted} tried
                  </span>
                  <Badge tone={i === 0 ? "accent" : "muted"}>#{i + 1}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <Card className="p-5 text-center">
          <Trophy className="mx-auto size-8 text-muted" />
          <p className="mt-2 text-sm text-muted">
            Turn the leaderboard on to rank this class by effort.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Child view: own rank card for the Class tab                         */
/* ------------------------------------------------------------------ */

export function ChildLeaderboardCard({
  classroomId,
  classroomName,
  childName,
}: {
  classroomId: string;
  classroomName: string;
  childName: string;
}) {
  const students = useTeacher((s) => s.students);
  const submissions = useTeacher((s) => s.submissions);
  const assignments = useTeacher((s) => s.assignments);
  const configs = useSocial((s) => s.leaderboardConfigs);
  const optIns = useSocial((s) => s.leaderboardOptIns);

  const config = configs.find((c) => c.classroomId === classroomId);
  const optedIn = optIns.some(
    (o) =>
      o.classroomId === classroomId &&
      o.studentName.trim().toLowerCase() === childName.trim().toLowerCase() &&
      o.optedIn,
  );

  const rows = useMemo(
    () => effortRanking(classroomId, students, submissions, assignments),
    [classroomId, students, submissions, assignments],
  );
  const ranked = useMemo(
    () =>
      rows.filter((r) =>
        optIns.some(
          (o) =>
            o.classroomId === classroomId &&
            o.studentName.trim().toLowerCase() === r.studentName.trim().toLowerCase() &&
            o.optedIn,
        ),
      ),
    [rows, optIns, classroomId],
  );

  if (!config?.enabled) return null;

  if (!optedIn) {
    return (
      <Card className="border-dashed p-4">
        <div className="flex items-center gap-3">
          <Trophy className="size-5 shrink-0 text-muted" />
          <p className="text-sm text-muted">
            {classroomName} has a leaderboard. Ask a parent to opt you in from
            the Teachers section.
          </p>
        </div>
      </Card>
    );
  }

  const myIndex = ranked.findIndex(
    (r) => r.studentName.trim().toLowerCase() === childName.trim().toLowerCase(),
  );
  const myRow = myIndex >= 0 ? ranked[myIndex] : null;

  return (
    <Card className="bg-accent-soft p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface text-accent">
          <Trophy className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base">Class leaderboard</CardTitle>
          <p className="text-sm text-muted">
            {myRow
              ? `You are #${myIndex + 1} of ${ranked.length} · ${myRow.completed} assignments done`
              : `You are unranked · ${ranked.length} classmates opted in`}
          </p>
        </div>
      </div>
      {config.namedMode && ranked.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {ranked.slice(0, 3).map((row, i) => {
            const mine =
              row.studentName.trim().toLowerCase() === childName.trim().toLowerCase();
            return (
              <li
                key={row.studentId}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                  mine ? "bg-surface font-semibold" : "text-muted",
                )}
              >
                {rankMedal(i + 1)}
                <span className="flex-1 truncate">{mine ? "You" : row.studentName}</span>
                <span className="text-xs tabular-nums">{row.completed} done</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <p className="mt-2 text-[11px] text-muted">
        Ranked by effort — assignments completed and participation. Never by Units.
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Parent view: opt the child in (default off)                         */
/* ------------------------------------------------------------------ */

export function ParentLeaderboardOptIn({ childName }: { childName: string }) {
  const classrooms = useTeacher((s) => s.classrooms);
  const students = useTeacher((s) => s.students);
  const configs = useSocial((s) => s.leaderboardConfigs);
  const optIns = useSocial((s) => s.leaderboardOptIns);
  const setStudentOptIn = useSocial((s) => s.setStudentOptIn);

  const enrolled = classrooms.filter((c) =>
    students.some(
      (s) =>
        s.classroomId === c.id &&
        s.name.trim().toLowerCase() === childName.trim().toLowerCase(),
    ),
  );

  if (enrolled.length === 0) return null;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Trophy className="size-5" />
        </span>
        <div>
          <CardTitle className="text-base">Leaderboard opt-in</CardTitle>
          <CardHint>
            Off by default. Opting in lets your child see their effort rank in
            that class.
          </CardHint>
        </div>
      </div>
      {enrolled.map((c) => {
        const enabled = configs.find((cfg) => cfg.classroomId === c.id)?.enabled ?? false;
        const optedIn = optIns.some(
          (o) =>
            o.classroomId === c.id &&
            o.studentName.trim().toLowerCase() === childName.trim().toLowerCase() &&
            o.optedIn,
        );
        return (
          <label
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3 text-sm font-medium"
          >
            <span>
              {c.name}
              <span className="block text-xs font-normal text-muted">
                {enabled
                  ? "Teacher has the leaderboard on for this class"
                  : "Teacher has the leaderboard off for this class"}
              </span>
            </span>
            <input
              type="checkbox"
              checked={optedIn}
              onChange={(e) => {
                setStudentOptIn(c.id, childName, e.target.checked);
                toast.message(
                  e.target.checked ? "Opted in to the leaderboard" : "Opted out",
                );
              }}
              className="size-4 shrink-0 accent-accent"
            />
          </label>
        );
      })}
    </Card>
  );
}
