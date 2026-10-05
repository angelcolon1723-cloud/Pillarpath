import { useEffect, useMemo, useRef, useState } from "react";
import {
  Armchair,
  Bell,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Coins,
  Copy,
  Download,
  FileSpreadsheet,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  LineChart,
  Megaphone,
  MessageSquare,
  Palette,
  Pencil,
  Plus,
  Presentation,
  RotateCcw,
  Settings as SettingsIcon,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, FieldLabel, NativeSelect } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useLedger } from "@/store/ledger";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  TeacherLeaderboard,
  ChildLeaderboardCard,
  ParentLeaderboardOptIn,
} from "@/components/kiddo/leaderboard";
import { TeacherShowcase } from "@/components/kiddo/showcase";
import { TeacherChalkboard } from "@/components/kiddo/teacher-chalkboard";
import { TeacherDeskChart } from "@/components/kiddo/teacher-desk-chart";
import { LiveChalkboardBanner } from "@/components/kiddo/live-chalkboard";
import { StudentClassroomExtras } from "@/components/kiddo/student-classroom-extras";
import {
  useTeacher,
  type TeacherAssignment,
  type TeacherClassroom,
  type TeacherConnection,
  type TeacherLesson,
  type TeacherStudent,
  type TeacherSubmission,
} from "@/store/teacher";
import {
  TeacherVerificationBanner,
  VerificationLockedSection,
  useTeacherVerificationStatus,
} from "@/components/kiddo/teacher-verification";
import { formatWhen } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type TeacherSection =
  | "dashboard"
  | "classes"
  | "lessons"
  | "assignments"
  | "students"
  | "units"
  | "progress"
  | "leaderboard"
  | "studio"
  | "resources"
  | "library"
  | "records"
  | "messages"
  | "chalkboard"
  | "deskchart"
  | "settings";

export function TeacherWorkspace({
  section,
  onNavigateSection,
}: {
  section: TeacherSection;
  onNavigateSection?: (section: TeacherSection) => void;
}) {
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [libraryMaterialId, setLibraryMaterialId] = useState<string | null>(null);
  const classrooms = useTeacher((s) => s.classrooms);
  const activeClassroom =
    classrooms.find((c) => c.id === classroomId) ?? classrooms[0] ?? null;

  // Pull the server workspace once per mount; the store keeps its seeded
  // local data until the server answers (and keeps it on failure).
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void useTeacher.getState().loadFromServer();
  }, []);

  const { status, loading, refresh } = useTeacherVerificationStatus();
  const user = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const gated = !loading && status !== "verified" && !isAdmin;
  // If the teacher gets verified mid-session (e.g. admin approves while the
  // workspace is open), the first load ran unverified and returned no
  // student data — pull the full workspace again on the transition.
  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (prev !== "verified" && status === "verified") {
      void useTeacher.getState().loadFromServer();
    }
  }, [status]);
  const lockedSection = (s: TeacherSection) =>
    gated && (s === "students" || s === "records" || s === "messages");

  return (
    <div className="screen-enter space-y-5">
      {activeClassroom ? (
        <ClassroomPicker
          activeId={activeClassroom.id}
          onPick={setClassroomId}
        />
      ) : null}
      {gated ? <TeacherVerificationBanner onSubmitted={refresh} /> : null}
      {section === "dashboard" ? <TeacherDashboard /> : null}
      {section === "classes" ? (
        <TeacherClasses
          activeClassroom={activeClassroom}
          onPick={setClassroomId}
        />
      ) : null}
      {section === "lessons" ? <TeacherLessons /> : null}
      {section === "assignments" ? (
        <TeacherAssignments activeClassroom={activeClassroom} creativeOnly={false} />
      ) : null}
      {section === "students" ? (
        lockedSection(section) ? (
          <VerificationLockedSection title={teacherNavLabels.students} />
        ) : (
          <TeacherStudents activeClassroom={activeClassroom} />
        )
      ) : null}
      {section === "units" ? (
        <TeacherUnits activeClassroom={activeClassroom} />
      ) : null}
      {section === "progress" ? (
        <TeacherProgress activeClassroom={activeClassroom} />
      ) : null}
      {section === "leaderboard" ? (
        <TeacherLeaderboard activeClassroom={activeClassroom} />
      ) : null}
      {section === "studio" ? (
        <>
          <TeacherAssignments activeClassroom={activeClassroom} creativeOnly />
          <TeacherShowcase activeClassroom={activeClassroom} />
        </>
      ) : null}
      {section === "resources" ? (
        <TeacherResources
          externalOpenId={libraryMaterialId}
          onExternalOpenConsumed={() => setLibraryMaterialId(null)}
        />
      ) : null}
      {section === "library" ? (
        <TeacherLibrary
          onOpenMaterial={(resourceId: string) => {
            setLibraryMaterialId(resourceId);
            onNavigateSection?.("resources");
          }}
        />
      ) : null}
      {section === "records" ? (
        lockedSection(section) ? (
          <VerificationLockedSection title={teacherNavLabels.records} />
        ) : (
          <TeacherRecords activeClassroom={activeClassroom} />
        )
      ) : null}
      {section === "messages" ? (
        lockedSection(section) ? (
          <VerificationLockedSection title={teacherNavLabels.messages} />
        ) : (
          <TeacherMessages activeClassroom={activeClassroom} />
        )
      ) : null}
      {section === "chalkboard" ? <TeacherChalkboard /> : null}
      {section === "deskchart" ? <TeacherDeskChart /> : null}
      {section === "settings" ? <TeacherSettings /> : null}
    </div>
  );
}

function ClassroomPicker({
  activeId,
  onPick,
}: {
  activeId: string;
  onPick: (id: string) => void;
}) {
  const classrooms = useTeacher((s) => s.classrooms);
  if (classrooms.length <= 1) return null;
  return (
    <Card className="flex flex-wrap items-center gap-2 p-3">
      <span className="px-2 text-xs font-semibold uppercase tracking-wider text-muted">
        Classroom
      </span>
      {classrooms.map((c) => (
        <Button
          key={c.id}
          type="button"
          size="sm"
          variant={c.id === activeId ? "default" : "outline"}
          onClick={() => onPick(c.id)}
        >
          {c.name}
        </Button>
      ))}
    </Card>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  text,
  className,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  className?: string;
}) {
  return (
    <header className={className}>
      <p className="text-sm font-medium text-muted">{eyebrow}</p>
      <h1 className="font-hand text-4xl font-semibold tracking-tight">{title}</h1>
      {text ? <p className="mt-1 text-sm text-muted">{text}</p> : null}
    </header>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted">{text}</p>;
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function TeacherDashboard() {
  const teacherName = useTeacher((s) => s.teacherName);
  const classrooms = useTeacher((s) => s.classrooms);
  const students = useTeacher((s) => s.students);
  const assignments = useTeacher((s) => s.assignments);
  const submissions = useTeacher((s) => s.submissions);
  const connections = useTeacher((s) => s.connections);
  const approveConnection = useTeacher((s) => s.approveConnection);
  const denyConnection = useTeacher((s) => s.denyConnection);

  const pendingReviews = submissions.filter((s) => s.status === "submitted");
  const pendingConnections = connections.filter((c) => c.status === "pending");

  const stats = [
    { icon: Users, label: "Classrooms", value: classrooms.length },
    { icon: GraduationCap, label: "Students", value: students.length },
    { icon: ClipboardList, label: "Active assignments", value: assignments.filter((a) => a.status === "active").length },
    { icon: Bell, label: "Reviews waiting", value: pendingReviews.length },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Teacher workspace"
        title={`Welcome, ${teacherName}`}
        text="Financial literacy, responsibility, and creativity — taught as a classroom experience."
        className="hero-notebook"
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4">
              <Icon className="size-5 text-accent" />
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                {s.value}
              </p>
              <p className="text-xs text-muted">{s.label}</p>
            </Card>
          );
        })}
      </div>

      {pendingConnections.length > 0 ? (
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Parent connection requests</CardTitle>
          <CardHint>
            Parents authorize their child's participation. Approve to connect the classroom.
          </CardHint>
          <div className="divide-y divide-border">
            {pendingConnections.map((c) => (
              <div key={c.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{c.childName}</p>
                  <p className="text-xs text-muted">
                    {c.classroomName} · requested {formatWhen(c.requestedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => {
                    approveConnection(c.id);
                    toast.success("Classroom connected");
                  }}
                >
                  <Check className="size-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    denyConnection(c.id);
                    toast.message("Request declined");
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {pendingReviews.length > 0 ? (
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">Submissions waiting for review</CardTitle>
          <div className="divide-y divide-border">
            {pendingReviews.slice(0, 5).map((s) => (
              <SubmissionRow key={s.id} submission={s} compact />
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="bg-vault p-5 text-vault-foreground">
        <p className="text-xs font-medium uppercase tracking-wider text-vault-foreground/60">
          Privacy boundary
        </p>
        <p className="mt-2 font-display text-xl font-semibold">
          You see learning — never family finances.
        </p>
        <p className="mt-1 text-sm text-vault-foreground/75">
          Classroom Units are a separate educational reward system. Family Unit
          balances, bank details, and private marketplace activity stay with parents.
        </p>
      </Card>
    </div>
  );
}

export function SubmissionRow({
  submission,
  compact,
}: {
  submission: TeacherSubmission;
  compact?: boolean;
}) {
  const assignments = useTeacher((s) => s.assignments);
  const assignment = assignments.find((a) => a.id === submission.assignmentId);
  const reviewSubmission = useTeacher((s) => s.reviewSubmission);
  const [feedback, setFeedback] = useState(submission.feedback);
  const [award, setAward] = useState(
    submission.unitsAwarded || assignment?.unitReward || 5,
  );

  return (
    <div className={cn("py-3", compact ? "" : "rounded-xl border border-border p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{submission.studentName}</p>
          <p className="text-xs text-muted">
            {assignment?.title ?? "Assignment"} · {formatWhen(submission.submittedAt)}
          </p>
        </div>
        <Badge
          tone={
            submission.status === "complete"
              ? "accent"
              : submission.status === "reviewed"
                ? "warn"
                : "muted"
          }
        >
          {submission.status}
        </Badge>
      </div>
      <p className="mt-2 rounded-lg bg-surface-2 p-3 text-sm">{submission.text}</p>
      {submission.status !== "complete" ? (
        <div className="mt-3 space-y-2">
          <FieldLabel>Feedback for the student</FieldLabel>
          <Input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What did they do well? What could improve?"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <FieldLabel>Classroom Units to award</FieldLabel>
              <Input
                type="number"
                min={0}
                value={award}
                onChange={(e) => setAward(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  const err = reviewSubmission(submission.id, {
                    feedback,
                    status: "reviewed",
                    awardUnits: 0,
                  });
                  if (err) toast.error(err);
                  else toast.message("Feedback sent");
                }}
              >
                Send feedback
              </Button>
              <Button
                variant="success"
                onClick={() => {
                  const err = reviewSubmission(submission.id, {
                    feedback,
                    status: "complete",
                    awardUnits: award,
                  });
                  if (err) toast.error(err);
                  else toast.success(`Marked complete · +${award} classroom Units`);
                }}
              >
                <Check className="size-4" /> Complete
              </Button>
            </div>
          </div>
        </div>
      ) : submission.feedback ? (
        <p className="mt-2 text-xs text-muted">
          Feedback: {submission.feedback}
          {submission.unitsAwarded > 0
            ? ` · +${submission.unitsAwarded} classroom Units awarded`
            : ""}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */

function TeacherClasses({
  activeClassroom,
  onPick,
}: {
  activeClassroom: TeacherClassroom | null;
  onPick: (id: string) => void;
}) {
  const classrooms = useTeacher((s) => s.classrooms);
  const createClassroom = useTeacher((s) => s.createClassroom);
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("Financial Literacy");

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="My classes"
        title="Classrooms"
        text="Create a classroom, share the join code, and manage students and announcements."
      />

      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">New classroom</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel>Classroom name</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Financial Literacy — Grade 6"
            />
          </div>
          <div>
            <FieldLabel>Grade level</FieldLabel>
            <Input
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              placeholder="Grade 6"
            />
          </div>
          <div>
            <FieldLabel>Subject</FieldLabel>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Financial Literacy"
            />
          </div>
        </div>
        <Button
          onClick={() => {
            if (!name.trim()) {
              toast.error("Give the classroom a name");
              return;
            }
            const classroom = createClassroom({ name, gradeLevel, subject });
            setName("");
            setGradeLevel("");
            onPick(classroom.id);
            toast.success(`Classroom created · join code ${classroom.joinCode}`);
          }}
        >
          <Plus className="size-4" /> Create classroom
        </Button>
      </Card>

      {classrooms.length === 0 ? (
        <EmptyHint text="No classrooms yet — create your first one above." />
      ) : (
        <div className="grid gap-3">
          {classrooms.map((c) => (
            <ClassroomCard
              key={c.id}
              classroom={c}
              active={activeClassroom?.id === c.id}
              onPick={() => onPick(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassroomCard({
  classroom,
  active,
  onPick,
}: {
  classroom: TeacherClassroom;
  active: boolean;
  onPick: () => void;
}) {
  const students = useTeacher((s) => s.students);
  const addStudent = useTeacher((s) => s.addStudent);
  const removeClassroomStudent = useTeacher((s) => s.removeClassroomStudent);
  const addAnnouncement = useTeacher((s) => s.addAnnouncement);
  const assignments = useTeacher((s) => s.assignments);
  const [studentName, setStudentName] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [showRoster, setShowRoster] = useState(active);

  const roster = students.filter((s) => s.classroomId === classroom.id);
  const classAssignments = assignments.filter(
    (a) => a.classroomId === classroom.id && a.status === "active",
  );

  return (
    <Card className={cn("p-4", active && "ring-2 ring-accent/40")}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onPick} className="min-w-0 flex-1 text-left">
          <h2 className="font-display text-xl font-semibold">{classroom.name}</h2>
          <p className="text-sm text-muted">
            {[classroom.gradeLevel, classroom.subject].filter(Boolean).join(" · ")}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone="muted">Join code · {classroom.joinCode}</Badge>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Copy join code"
            title="Copy join code"
            onClick={() => {
              void navigator.clipboard
                .writeText(classroom.joinCode)
                .then(() => toast.success("Join code copied"))
                .catch(() => toast.error("Could not copy the join code"));
            }}
          >
            <Copy className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span>{roster.length} students</span>
        <span>{classAssignments.length} active assignments</span>
        <span>{classroom.announcements.length} announcements</span>
      </div>

      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRoster((v) => !v)}
        >
          {showRoster ? "Hide details" : "Roster & announcements"}
        </Button>
      </div>

      {showRoster ? (
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          <div>
            <FieldLabel>Enroll a student</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Student name"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  const err = addStudent(classroom.id, studentName);
                  if (err) toast.error(err);
                  else {
                    setStudentName("");
                    toast.success("Student enrolled");
                  }
                }}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            {roster.length > 0 ? (
              <ul className="mt-2 divide-y divide-border">
                {roster.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {s.name}
                      <span className="ml-2 text-xs text-muted">
                        joined {formatWhen(s.joinedAt)}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${s.name}`}
                      title="Remove student"
                      onClick={() => {
                        if (window.confirm(`Remove ${s.name} from ${classroom.name}?`)) {
                          removeClassroomStudent(s.id);
                          toast.message("Student removed");
                        }
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-muted">
                No students yet — share the join code or enroll manually.
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Post an announcement</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                placeholder="Reminder for the class…"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!announcement.trim()) return;
                  addAnnouncement(classroom.id, announcement);
                  setAnnouncement("");
                  toast.success("Announcement posted");
                }}
              >
                <Megaphone className="size-4" />
              </Button>
            </div>
            {classroom.announcements.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {classroom.announcements.slice(0, 3).map((a) => (
                  <li key={a.id} className="rounded-lg bg-surface-2 p-3 text-sm">
                    {a.text}
                    <span className="block text-xs text-muted">{formatWhen(a.at)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

function TeacherLessons() {
  const lessons = useTeacher((s) => s.lessons);
  const createLesson = useTeacher((s) => s.createLesson);
  const updateLesson = useTeacher((s) => s.updateLesson);
  const deleteLesson = useTeacher((s) => s.deleteLesson);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyForm = {
    module: "",
    title: "",
    description: "",
    objective: "",
    instructions: "",
    materials: "",
    questions: "",
    completionRequirements: "",
    unitReward: 10,
    dueDate: "",
  };
  const [form, setForm] = useState(emptyForm);

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(lesson: TeacherLesson) {
    setForm({
      module: lesson.module,
      title: lesson.title,
      description: lesson.description,
      objective: lesson.objective,
      instructions: lesson.instructions,
      materials: lesson.materials,
      questions: lesson.questions,
      completionRequirements: lesson.completionRequirements,
      unitReward: lesson.unitReward,
      dueDate: lesson.dueDate,
    });
    setEditingId(lesson.id);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Lessons"
        title="Financial literacy curriculum"
        text="The 10-module starter curriculum ships with PillarPath — add your own lessons anytime."
      />

      <Button
        onClick={() => {
          if (!open) resetForm();
          setOpen((v) => !v);
        }}
      >
        <Plus className="size-4" /> {open ? "Close builder" : "New lesson"}
      </Button>

      {open ? (
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">{editingId ? "Edit lesson" : "Lesson builder"}</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Module</FieldLabel>
              <Input value={form.module} onChange={(e) => set("module", e.target.value)} placeholder="Module 11" />
            </div>
            <div>
              <FieldLabel>Title</FieldLabel>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Understanding Saving" />
            </div>
          </div>
          <div>
            <FieldLabel>Description</FieldLabel>
            <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="One-line summary" />
          </div>
          <div>
            <FieldLabel>Learning objective</FieldLabel>
            <Input value={form.objective} onChange={(e) => set("objective", e.target.value)} placeholder="Students will be able to…" />
          </div>
          <div>
            <FieldLabel>Instructions</FieldLabel>
            <Input value={form.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="What students should do" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Materials</FieldLabel>
              <Input value={form.materials} onChange={(e) => set("materials", e.target.value)} placeholder="Worksheets, links…" />
            </div>
            <div>
              <FieldLabel>Discussion questions</FieldLabel>
              <Input value={form.questions} onChange={(e) => set("questions", e.target.value)} placeholder="Questions to explore" />
            </div>
          </div>
          <div>
            <FieldLabel>Completion requirements</FieldLabel>
            <Input value={form.completionRequirements} onChange={(e) => set("completionRequirements", e.target.value)} placeholder="What counts as done" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Classroom Unit reward</FieldLabel>
              <Input type="number" min={0} value={form.unitReward} onChange={(e) => set("unitReward", Number(e.target.value))} />
            </div>
            <div>
              <FieldLabel>Due date (optional)</FieldLabel>
              <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => {
              const err = editingId ? updateLesson(editingId, form) : createLesson(form);
              if (err) toast.error(err);
              else {
                setOpen(false);
                resetForm();
                toast.success(editingId ? "Lesson updated" : "Lesson created");
              }
            }}
          >
            {editingId ? "Save changes" : "Save lesson"}
          </Button>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {lessons.map((l) => (
          <LessonCard
            key={l.id}
            lesson={l}
            onEdit={() => startEdit(l)}
            onDelete={() => {
              if (window.confirm(`Delete "${l.title}"?`)) {
                deleteLesson(l.id);
                toast.message("Lesson deleted");
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}

function LessonCard({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: TeacherLesson;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <BookOpen className="size-5" />
          </span>
          <div>
            {lesson.module ? (
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                {lesson.module}
              </p>
            ) : null}
            <h2 className="font-semibold">{lesson.title}</h2>
            <p className="text-sm text-muted">{lesson.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {lesson.unitReward > 0 ? (
            <Badge tone="accent">+{lesson.unitReward} Units</Badge>
          ) : null}
          <Button variant="outline" size="sm" onClick={onEdit} aria-label="Edit lesson">
            <Pencil className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} aria-label="Delete lesson">
            <Trash2 className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Less" : "Details"}
          </Button>
        </div>
      </div>
      {expanded ? (
        <dl className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
          {[
            ["Objective", lesson.objective],
            ["Instructions", lesson.instructions],
            ["Materials", lesson.materials],
            ["Questions", lesson.questions],
            ["To complete", lesson.completionRequirements],
            ["Due", lesson.dueDate || "—"],
          ].map(([k, v]) =>
            v ? (
              <div key={k} className="grid grid-cols-[110px_1fr] gap-2">
                <dt className="text-muted">{k}</dt>
                <dd>{v}</dd>
              </div>
            ) : null,
          )}
        </dl>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Assignments (standard + creative studio)                            */
/* ------------------------------------------------------------------ */

const CREATIVE_PROMPTS = [
  "Design a company logo for your Module 9 business idea",
  "Create a T-shirt design that teaches a money habit",
  "Make a financial education poster for the classroom wall",
  "Design a coloring page about saving",
  "Create a product advertisement for something you would sell",
];

function TeacherAssignments({
  activeClassroom,
  creativeOnly,
}: {
  activeClassroom: TeacherClassroom | null;
  creativeOnly: boolean;
}) {
  const classrooms = useTeacher((s) => s.classrooms);
  const assignments = useTeacher((s) => s.assignments);
  const submissions = useTeacher((s) => s.submissions);
  const createAssignment = useTeacher((s) => s.createAssignment);
  const updateAssignment = useTeacher((s) => s.updateAssignment);
  const deleteAssignment = useTeacher((s) => s.deleteAssignment);
  const closeAssignment = useTeacher((s) => s.closeAssignment);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const emptyAssignmentForm = () => ({
    classroomId: activeClassroom?.id ?? "",
    title: "",
    instructions: "",
    attachmentsNote: "",
    dueDate: "",
    scoringCriteria: "",
    unitReward: 10,
  });
  const [form, setForm] = useState(emptyAssignmentForm);

  const list = assignments.filter((a) =>
    creativeOnly ? a.kind === "creative" : a.kind === "standard",
  );

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  function startEdit(a: TeacherAssignment) {
    setForm({
      classroomId: a.classroomId,
      title: a.title,
      instructions: a.instructions,
      attachmentsNote: a.attachmentsNote,
      dueDate: a.dueDate,
      scoringCriteria: a.scoringCriteria,
      unitReward: a.unitReward,
    });
    setEditingId(a.id);
    setOpen(true);
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow={creativeOnly ? "Creative Studio · teacher" : "Assignments"}
        title={creativeOnly ? "Creative assignments" : "Assignments"}
        text={
          creativeOnly
            ? "Assign logo, T-shirt, poster, and coloring projects from Creative Studio."
            : "Create → students submit → you review → feedback → complete → classroom Units are awarded."
        }
      />

      {creativeOnly ? (
        <Card className="p-4">
          <CardTitle className="text-base">Creative prompt ideas</CardTitle>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {CREATIVE_PROMPTS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Button
        onClick={() => {
          if (!open) {
            setEditingId(null);
            setForm(emptyAssignmentForm());
          }
          setOpen((v) => !v);
        }}
      >
        <Plus className="size-4" /> {open ? "Close builder" : creativeOnly ? "New creative assignment" : "New assignment"}
      </Button>

      {open ? (
        <Card className="space-y-3 p-4">
          <CardTitle className="text-base">{editingId ? "Edit assignment" : "Assignment builder"}</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Classroom</FieldLabel>
              <NativeSelect
                value={form.classroomId}
                onChange={(e) => set("classroomId", e.target.value)}
              >
                <option value="">Choose a classroom</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <FieldLabel>Title</FieldLabel>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder={creativeOnly ? "Design a savings poster" : "Build a weekly budget"}
              />
            </div>
          </div>
          <div>
            <FieldLabel>Instructions</FieldLabel>
            <Input
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="What should students do, step by step?"
            />
          </div>
          <div>
            <FieldLabel>Attachments / materials note</FieldLabel>
            <Input
              value={form.attachmentsNote}
              onChange={(e) => set("attachmentsNote", e.target.value)}
              placeholder="e.g. Budget grid handout, poster paper"
            />
          </div>
          <div>
            <FieldLabel>Scoring criteria</FieldLabel>
            <Input
              value={form.scoringCriteria}
              onChange={(e) => set("scoringCriteria", e.target.value)}
              placeholder="How will this be evaluated?"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Classroom Unit reward</FieldLabel>
              <Input
                type="number"
                min={0}
                value={form.unitReward}
                onChange={(e) => set("unitReward", Number(e.target.value))}
              />
            </div>
            <div>
              <FieldLabel>Due date</FieldLabel>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={() => {
              const payload = {
                ...form,
                kind: creativeOnly ? "creative" : "standard",
              } as const;
              const err = editingId
                ? updateAssignment(editingId, payload)
                : createAssignment(payload);
              if (err) toast.error(err);
              else {
                setOpen(false);
                setEditingId(null);
                setForm(emptyAssignmentForm());
                toast.success(
                  editingId ? "Assignment updated" : "Assignment published to the classroom",
                );
              }
            }}
          >
            {editingId ? "Save changes" : "Publish assignment"}
          </Button>
        </Card>
      ) : null}

      {list.length === 0 ? (
        <EmptyHint
          text={creativeOnly ? "No creative assignments yet." : "No assignments yet — create the first one above."}
        />
      ) : (
        <div className="space-y-4">
          {list.map((a) => {
            const subs = submissions.filter((s) => s.assignmentId === a.id);
            const waiting = subs.filter((s) => s.status === "submitted").length;
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{a.title}</h2>
                      <Badge tone={a.status === "active" ? "accent" : "warn"}>
                        {a.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">{a.instructions}</p>
                    <p className="mt-1 text-xs text-muted">
                      {a.dueDate ? `Due ${a.dueDate} · ` : ""}
                      {subs.length} submissions
                      {waiting > 0 ? ` · ${waiting} waiting` : ""}
                      {a.unitReward > 0 ? ` · +${a.unitReward} Units on completion` : ""}
                    </p>
                  </div>
                  {a.status === "active" ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(a)}
                        aria-label="Edit assignment"
                      >
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Delete "${a.title}"? Its submissions go with it.`)) {
                            deleteAssignment(a.id);
                            toast.message("Assignment deleted");
                          }
                        }}
                        aria-label="Delete assignment"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          closeAssignment(a.id);
                          toast.message("Assignment closed");
                        }}
                      >
                        Close
                      </Button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(`Delete "${a.title}"? Its submissions go with it.`)) {
                            deleteAssignment(a.id);
                            toast.message("Assignment deleted");
                          }
                        }}
                        aria-label="Delete assignment"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
                {subs.length > 0 ? (
                  <div className="mt-3 space-y-3 border-t border-border pt-3">
                    {subs.map((s) => (
                      <SubmissionRow key={s.id} submission={s} />
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Students                                                            */
/* ------------------------------------------------------------------ */

function TeacherStudents({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const students = useTeacher((s) => s.students);
  const submissions = useTeacher((s) => s.submissions);
  const assignments = useTeacher((s) => s.assignments);
  const classroomUnitBalance = useTeacher((s) => s.classroomUnitBalance);
  const removeClassroomStudent = useTeacher((s) => s.removeClassroomStudent);

  if (!activeClassroom) {
    return (
      <div className="space-y-5">
        <SectionHeader eyebrow="Students" title="Students" />
        <EmptyHint text="Create a classroom first." />
      </div>
    );
  }

  const roster = students.filter((s) => s.classroomId === activeClassroom.id);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Students"
        title={activeClassroom.name}
        text="Educational profiles only — assignment status, lesson progress, and classroom Units."
      />
      {roster.length === 0 ? (
        <EmptyHint text="No students enrolled yet." />
      ) : (
        <div className="grid gap-3">
          {roster.map((student) => {
            const studentSubs = submissions.filter((st) => st.studentId === student.id);
            const completed = studentSubs.filter((st) => st.status === "complete").length;
            const activeCount = assignments.filter(
              (a) => a.classroomId === activeClassroom.id && a.status === "active",
            ).length;
            return (
              <StudentCard
                key={student.id}
                student={student}
                completed={completed}
                activeCount={activeCount}
                balance={classroomUnitBalance(student.id)}
                onRemove={() => {
                  if (window.confirm(`Remove ${student.name} from ${activeClassroom.name}?`)) {
                    removeClassroomStudent(student.id);
                    toast.message("Student removed");
                  }
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function StudentCard({
  student,
  completed,
  activeCount,
  balance,
  onRemove,
}: {
  student: TeacherStudent;
  completed: number;
  activeCount: number;
  balance: number;
  onRemove?: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-accent-soft font-display text-lg font-semibold text-accent">
          {student.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{student.name}</h2>
          <p className="text-xs text-muted">Joined {formatWhen(student.joinedAt)}</p>
        </div>
        <Badge tone="muted">{balance} classroom Units</Badge>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${student.name}`}
            title="Remove student"
            onClick={onRemove}
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="font-display text-xl font-semibold tabular-nums">{completed}</p>
          <p className="text-xs text-muted">Completed</p>
        </div>
        <div className="rounded-lg bg-surface-2 p-2">
          <p className="font-display text-xl font-semibold tabular-nums">{activeCount}</p>
          <p className="text-xs text-muted">Open assignments</p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Classroom Units                                                     */
/* ------------------------------------------------------------------ */

function TeacherUnits({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const students = useTeacher((s) => s.students);
  const unitEvents = useTeacher((s) => s.unitEvents);
  const classroomUnitBalance = useTeacher((s) => s.classroomUnitBalance);
  const awardClassroomUnits = useTeacher((s) => s.awardClassroomUnits);
  const earningActivities = useTeacher((s) => s.earningActivities);
  const addEarningActivity = useTeacher((s) => s.addEarningActivity);
  const updateEarningActivity = useTeacher((s) => s.updateEarningActivity);
  const removeEarningActivity = useTeacher((s) => s.removeEarningActivity);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState(5);
  const [note, setNote] = useState("");
  const [quickStudentId, setQuickStudentId] = useState("");
  const [quickActivityId, setQuickActivityId] = useState("");
  const [manageActivities, setManageActivities] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityName, setActivityName] = useState("");
  const [activityAmount, setActivityAmount] = useState(10);
  const [activityHint, setActivityHint] = useState("");

  if (!activeClassroom) {
    return (
      <div className="space-y-5">
        <SectionHeader eyebrow="Classroom Units" title="Classroom Units" />
        <EmptyHint text="Create a classroom first." />
      </div>
    );
  }

  const roster = students.filter((s) => s.classroomId === activeClassroom.id);
  const events = unitEvents.filter((e) =>
    roster.some((r) => r.id === e.studentId),
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Classroom Units"
        title="Educational rewards"
        text="Classroom Units are separate from family Units. They reward learning — they never touch family finances."
      />

      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">Award classroom Units</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <FieldLabel>Student</FieldLabel>
            <NativeSelect value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Choose a student</option>
              {roster.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({classroomUnitBalance(s.id)})
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel>Units</FieldLabel>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div>
            <FieldLabel>Reason</FieldLabel>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Great participation"
            />
          </div>
        </div>
        <Button
          onClick={() => {
            if (!studentId) {
              toast.error("Choose a student");
              return;
            }
            const err = awardClassroomUnits(studentId, amount, note);
            if (err) toast.error(err);
            else {
              setNote("");
              toast.success("Classroom Units awarded");
            }
          }}
        >
          <Coins className="size-4" /> Award Units
        </Button>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Quick award from activity</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setManageActivities((v) => !v)}
          >
            {manageActivities ? "Done" : "Manage activities"}
          </Button>
        </div>
        <CardHint>
          Pick a classroom earning activity — participation, milestones, teamwork —
          and award it to a student. Awards land in the classroom Unit ledger.
        </CardHint>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Student</FieldLabel>
            <NativeSelect
              value={quickStudentId}
              onChange={(e) => setQuickStudentId(e.target.value)}
            >
              <option value="">Choose a student</option>
              {roster.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div>
            <FieldLabel>Activity</FieldLabel>
            <NativeSelect
              value={quickActivityId}
              onChange={(e) => setQuickActivityId(e.target.value)}
            >
              <option value="">Choose an activity</option>
              {earningActivities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · +{a.amount}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={() => {
            const activity = earningActivities.find((a) => a.id === quickActivityId);
            if (!quickStudentId) {
              toast.error("Choose a student");
              return;
            }
            if (!activity) {
              toast.error("Choose an activity");
              return;
            }
            const err = awardClassroomUnits(
              quickStudentId,
              activity.amount,
              `Classroom activity · ${activity.name}`,
            );
            if (err) toast.error(err);
            else toast.success(`+${activity.amount} classroom Units awarded`);
          }}
        >
          <Coins className="size-4" /> Award activity Units
        </Button>

        {manageActivities ? (
          <div className="space-y-3 border-t border-border pt-4">
            <CardTitle className="text-base">Earning activities</CardTitle>
            <div className="space-y-2">
              {earningActivities.map((a) =>
                editingActivityId === a.id ? (
                  <Card key={a.id} className="space-y-2 bg-surface-2 p-3">
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <FieldLabel>Name</FieldLabel>
                        <Input
                          value={activityName}
                          onChange={(e) => setActivityName(e.target.value)}
                        />
                      </div>
                      <div>
                        <FieldLabel>Units</FieldLabel>
                        <Input
                          type="number"
                          min={1}
                          value={activityAmount}
                          onChange={(e) => setActivityAmount(Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Hint</FieldLabel>
                      <Input
                        value={activityHint}
                        onChange={(e) => setActivityHint(e.target.value)}
                        placeholder="What earns this?"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          const err = updateEarningActivity(a.id, {
                            name: activityName,
                            amount: activityAmount,
                            hint: activityHint,
                          });
                          if (err) toast.error(err);
                          else {
                            setEditingActivityId(null);
                            toast.success("Activity updated");
                          }
                        }}
                      >
                        <Check className="size-4" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingActivityId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{a.name}</p>
                      <p className="text-xs text-muted">
                        +{a.amount} Units{a.hint ? ` · ${a.hint}` : ""}
                      </p>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Edit"
                      onClick={() => {
                        setEditingActivityId(a.id);
                        setActivityName(a.name);
                        setActivityAmount(a.amount);
                        setActivityHint(a.hint);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label="Delete"
                      onClick={() => {
                        removeEarningActivity(a.id);
                        toast.message("Activity removed");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ),
              )}
            </div>
            <div className="grid gap-2 rounded-xl border border-dashed border-border p-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <FieldLabel>New activity</FieldLabel>
                <Input
                  value={activityName}
                  onChange={(e) => setActivityName(e.target.value)}
                  placeholder="e.g. Science fair ribbon"
                />
              </div>
              <div>
                <FieldLabel>Units</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={activityAmount}
                  onChange={(e) => setActivityAmount(Number(e.target.value))}
                />
              </div>
              <div className="sm:col-span-3">
                <FieldLabel>Hint (optional)</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    value={activityHint}
                    onChange={(e) => setActivityHint(e.target.value)}
                    placeholder="What earns this?"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const err = addEarningActivity({
                        name: activityName,
                        amount: activityAmount,
                        hint: activityHint,
                      });
                      if (err) toast.error(err);
                      else {
                        setActivityName("");
                        setActivityAmount(10);
                        setActivityHint("");
                        toast.success("Activity added");
                      }
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        {roster.map((s) => (
          <Card key={s.id} className="flex items-center justify-between p-3">
            <span className="text-sm font-semibold">{s.name}</span>
            <Badge tone="accent">{classroomUnitBalance(s.id)} Units</Badge>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <CardTitle className="text-base">Unit activity</CardTitle>
        {events.length === 0 ? (
          <EmptyHint text="No classroom Unit activity yet." />
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {events.slice(0, 20).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{e.note}</p>
                  <p className="text-xs text-muted">
                    {e.studentName} · {formatWhen(e.at)}
                  </p>
                </div>
                <span className="font-mono text-sm text-success tabular-nums">
                  +{e.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

function TeacherProgress({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const students = useTeacher((s) => s.students);
  const assignments = useTeacher((s) => s.assignments);
  const submissions = useTeacher((s) => s.submissions);

  if (!activeClassroom) {
    return (
      <div className="space-y-5">
        <SectionHeader eyebrow="Progress" title="Progress" />
        <EmptyHint text="Create a classroom first." />
      </div>
    );
  }

  const classAssignments = assignments.filter(
    (a) => a.classroomId === activeClassroom.id,
  );
  const roster = students.filter((s) => s.classroomId === activeClassroom.id);
  const submitted = submissions.filter((s) =>
    classAssignments.some((a) => a.id === s.assignmentId),
  );
  const completed = submitted.filter((s) => s.status === "complete");

  const completionRate =
    classAssignments.length > 0 && roster.length > 0
      ? Math.round(
          (completed.length / (classAssignments.length * roster.length)) * 100,
        )
      : 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Progress"
        title={activeClassroom.name}
        text="Class and student progress across lessons and assignments."
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Assignments", value: classAssignments.length },
          { label: "Submissions", value: submitted.length },
          { label: "Completed", value: completed.length },
          { label: "Completion", value: `${Math.min(100, completionRate)}%` },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <p className="font-display text-3xl font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <CardTitle className="text-base">Overall completion</CardTitle>
        <Progress value={Math.min(100, completionRate)} className="mt-3" />
      </Card>

      <Card className="p-4">
        <CardTitle className="text-base">Per-student progress</CardTitle>
        {roster.length === 0 ? (
          <EmptyHint text="No students enrolled yet." />
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {roster.map((student) => {
              const done = submissions.filter(
                (s) => s.studentId === student.id && s.status === "complete",
              ).length;
              const total = classAssignments.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <li key={student.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{student.name}</span>
                    <span className="text-xs text-muted tabular-nums">
                      {done}/{total} · {pct}%
                    </span>
                  </div>
                  <Progress value={pct} className="mt-2" />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

import { NeedsWantsDeck } from "@/components/kiddo/teacher-resources/needs-wants";
import { BudgetGrid } from "@/components/kiddo/teacher-resources/budget-grid";
import { SavingsPlan } from "@/components/kiddo/teacher-resources/savings-plan";
import { MarketSim } from "@/components/kiddo/teacher-resources/market-sim";
import { BusinessPlan } from "@/components/kiddo/teacher-resources/business-plan";
import { DiscussionPrompts } from "@/components/kiddo/teacher-resources/discussion-prompts";
import { TeacherLibrary } from "@/components/kiddo/teacher-library";

const RESOURCE_CONTENT: Record<string, () => React.JSX.Element> = {
  "res-1": NeedsWantsDeck,
  "res-2": BudgetGrid,
  "res-3": SavingsPlan,
  "res-4": MarketSim,
  "res-5": BusinessPlan,
  "res-6": DiscussionPrompts,
};

function TeacherResources({
  externalOpenId,
  onExternalOpenConsumed,
}: {
  externalOpenId?: string | null;
  onExternalOpenConsumed?: () => void;
} = {}) {
  const resources = useTeacher((s) => s.resources);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (externalOpenId) {
      setOpenId(externalOpenId);
      onExternalOpenConsumed?.();
    }
  }, [externalOpenId]);
  const open = resources.find((r) => r.id === openId);
  const Content = open ? RESOURCE_CONTENT[open.id] : null;

  if (open && Content) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="text-sm font-semibold text-accent hover:underline print:hidden"
        >
          ← All teaching materials
        </button>
        <Content />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Resources"
        title="Teaching materials"
        text="Lesson plans, worksheets, and classroom activities included with PillarPath. Tap one to open the full material — then print it."
      />
      <div className="grid gap-3">
        {resources.map((r) => (
          <button key={r.id} type="button" onClick={() => setOpenId(r.id)} className="text-left">
            <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-md">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                <Library className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{r.title}</h2>
                  <Badge tone="muted">{r.kind}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted">{r.description}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </Card>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Records — classroom-level import/export. Company-wide records live   */
/* on the PillarPath Society Network admin dashboard (corporate side).  */
/* ------------------------------------------------------------------ */

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function TeacherRecords({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const students = useTeacher((s) => s.students);
  const assignments = useTeacher((s) => s.assignments);
  const submissions = useTeacher((s) => s.submissions);
  const importRoster = useTeacher((s) => s.importRoster);
  const [preview, setPreview] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");

  const roster = useMemo(
    () =>
      activeClassroom
        ? students.filter((s) => s.classroomId === activeClassroom.id)
        : [],
    [students, activeClassroom],
  );

  function onPickFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const names = text
        .split(/\r?\n/)
        .map((line) => {
          // take the first column (name) if the row has commas
          const first = line.split(",")[0] ?? "";
          return first.replace(/^["'\s]+|["'\s]+$/g, "");
        })
        .filter((n) => n.length > 0);
      // drop a header row if it looks like one
      const cleaned =
        names.length > 0 && /^(name|student|full name)$/i.test(names[0])
          ? names.slice(1)
          : names;
      setPreview(cleaned.slice(0, 500));
    };
    reader.readAsText(file);
  }

  function doImport() {
    if (!activeClassroom) {
      toast.error("Choose a classroom first");
      return;
    }
    if (preview.length === 0) {
      toast.error("No names to import");
      return;
    }
    const { imported, skipped } = importRoster(activeClassroom.id, preview);
    setPreview([]);
    setFileName("");
    toast.success(
      `Imported ${imported} student${imported === 1 ? "" : "s"}${
        skipped > 0 ? ` · ${skipped} skipped (blank or duplicate)` : ""
      }`,
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);

  function exportRoster() {
    if (!activeClassroom) return toast.error("Choose a classroom first");
    downloadCsv(`roster-${activeClassroom.name}-${stamp}.csv`, [
      ["Name", "Joined"],
      ...roster.map((s) => [s.name, s.joinedAt.slice(0, 10)]),
    ]);
    toast.success("Roster downloaded");
  }

  function exportAssignments() {
    if (!activeClassroom) return toast.error("Choose a classroom first");
    const list = assignments.filter(
      (a) => a.classroomId === activeClassroom.id,
    );
    downloadCsv(`assignments-${activeClassroom.name}-${stamp}.csv`, [
      ["Title", "Status", "Unit reward", "Due date", "Created"],
      ...list.map((a) => [
        a.title,
        a.status,
        String(a.unitReward),
        a.dueDate,
        a.createdAt.slice(0, 10),
      ]),
    ]);
    toast.success("Assignments downloaded");
  }

  function exportGradebook() {
    if (!activeClassroom) return toast.error("Choose a classroom first");
    const classAssignIds = new Set(
      assignments
        .filter((a) => a.classroomId === activeClassroom.id)
        .map((a) => a.id),
    );
    const titleById = new Map(assignments.map((a) => [a.id, a.title]));
    const list = submissions.filter((s) => classAssignIds.has(s.assignmentId));
    downloadCsv(`gradebook-${activeClassroom.name}-${stamp}.csv`, [
      ["Student", "Assignment", "Status", "Units awarded", "Submitted", "Feedback"],
      ...list.map((s) => [
        s.studentName,
        titleById.get(s.assignmentId) ?? "",
        s.status,
        String(s.unitsAwarded),
        s.submittedAt.slice(0, 10),
        s.feedback,
      ]),
    ]);
    toast.success("Gradebook downloaded");
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Records"
        title="Classroom records"
        text="Import your class roster from a spreadsheet and export classroom data. Company-wide records live on the Society Network admin dashboard."
      />
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Upload className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Import roster</CardTitle>
            <CardHint>
              Upload a CSV with one student name per line (first column). Duplicates are skipped.
            </CardHint>
          </div>
        </div>
        <label className="block cursor-pointer rounded-xl border border-dashed border-border bg-surface p-4 text-center text-sm text-muted hover:border-accent/50">
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
          {fileName ? `Selected: ${fileName}` : "Tap to choose a CSV file"}
        </label>
        {preview.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {preview.length} name{preview.length === 1 ? "" : "s"} ready to import
              {activeClassroom ? ` into ${activeClassroom.name}` : ""}
            </p>
            <div className="max-h-40 overflow-auto rounded-xl border border-border bg-surface p-3 text-sm">
              {preview.slice(0, 20).map((n, i) => (
                <p key={i} className="py-0.5">{n}</p>
              ))}
              {preview.length > 20 ? (
                <p className="text-xs text-muted">…and {preview.length - 20} more</p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button onClick={doImport}>
                <Upload className="size-4" /> Import {preview.length} students
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPreview([]);
                  setFileName("");
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
            <Download className="size-5" />
          </span>
          <div>
            <CardTitle className="text-base">Export data</CardTitle>
            <CardHint>Download this classroom's data as CSV files.</CardHint>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" onClick={exportRoster}>
            <Download className="size-4" /> Roster
          </Button>
          <Button variant="outline" onClick={exportAssignments}>
            <Download className="size-4" /> Assignments
          </Button>
          <Button variant="outline" onClick={exportGradebook}>
            <Download className="size-4" /> Gradebook
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function TeacherMessages({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const [tab, setTab] = useState<"announcements" | "families">("announcements");
  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Messages"
        title="Classroom messages"
        text="Announcements for your classes, plus private two-way conversations with families."
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={tab === "announcements" ? "default" : "outline"}
          onClick={() => setTab("announcements")}
        >
          <Megaphone className="size-4" /> Announcements
        </Button>
        <Button
          size="sm"
          variant={tab === "families" ? "default" : "outline"}
          onClick={() => setTab("families")}
        >
          <MessageSquare className="size-4" /> Family messages
        </Button>
      </div>
      {tab === "announcements" ? (
        <TeacherAnnouncements activeClassroom={activeClassroom} />
      ) : (
        <TeacherFamilyThreads activeClassroom={activeClassroom} />
      )}
    </div>
  );
}

function TeacherAnnouncements({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const classrooms = useTeacher((s) => s.classrooms);
  const messages = useTeacher((s) => s.messages);
  const sendMessage = useTeacher((s) => s.sendMessage);
  const [audience, setAudience] = useState(activeClassroom?.id ?? "all");
  const [text, setText] = useState("");

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Messages"
        title="Classroom messages"
        text="Announcements and updates for your classes."
      />
      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">New message</CardTitle>
        <div>
          <FieldLabel>Audience</FieldLabel>
          <NativeSelect value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all">All classrooms</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div>
          <FieldLabel>Message</FieldLabel>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reminder: budget assignment is due Friday…"
          />
        </div>
        <Button
          onClick={() => {
            const label =
              audience === "all"
                ? "All classrooms"
                : (classrooms.find((c) => c.id === audience)?.name ?? "Classroom");
            const err = sendMessage(label, text);
            if (err) toast.error(err);
            else {
              setText("");
              toast.success("Message sent");
            }
          }}
        >
          <MessageSquare className="size-4" /> Send
        </Button>
      </Card>

      {messages.length === 0 ? (
        <EmptyHint text="No messages yet." />
      ) : (
        <div className="space-y-2">
          {messages.map((m) => (
            <Card key={m.id} className="p-4">
              <div className="flex items-center justify-between">
                <Badge tone="muted">{m.audience}</Badge>
                <span className="text-xs text-muted">{formatWhen(m.at)}</span>
              </div>
              <p className="mt-2 text-sm">{m.text}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherFamilyThreads({
  activeClassroom,
}: {
  activeClassroom: TeacherClassroom | null;
}) {
  const threads = useTeacher((s) => s.threads);
  const connections = useTeacher((s) => s.connections);
  const startThread = useTeacher((s) => s.startThread);
  const sendThreadMessage = useTeacher((s) => s.sendThreadMessage);
  const [openId, setOpenId] = useState<string | null>(null);
  const [parentName, setParentName] = useState("");
  const [childName, setChildName] = useState("");
  const [linkedParentId, setLinkedParentId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const linkedFamilies = useMemo(
    () =>
      connections.filter(
        (c) =>
          c.status === "approved" &&
          c.parentUserId &&
          (!activeClassroom || c.classroomId === activeClassroom.id),
      ),
    [connections, activeClassroom],
  );

  function pickFamily(connectionId: string) {
    if (!connectionId) {
      setLinkedParentId(null);
      setParentName("");
      setChildName("");
      return;
    }
    const c = linkedFamilies.find((x) => x.id === connectionId);
    if (!c) return;
    setLinkedParentId(c.parentUserId);
    setParentName(c.parentAccountName ?? "");
    setChildName(c.childName);
  }

  const visible = useMemo(
    () =>
      activeClassroom
        ? threads.filter((t) => t.classroomId === activeClassroom.id)
        : threads,
    [threads, activeClassroom],
  );
  const open = visible.find((t) => t.id === openId) ?? null;

  function newThread() {
    if (!activeClassroom) {
      toast.error("Choose a classroom first");
      return;
    }
    const id = startThread(activeClassroom.id, parentName, childName, linkedParentId);
    if (!id) {
      toast.error("Enter the parent and child names");
      return;
    }
    setParentName("");
    setChildName("");
    setLinkedParentId(null);
    setOpenId(id);
    toast.success(
      linkedParentId
        ? "Conversation started \u2014 linked to the family's inbox"
        : "Conversation started",
    );
  }

  function send() {
    if (!open) return;
    const err = sendThreadMessage(open.id, "teacher", reply);
    if (err) toast.error(err);
    else setReply("");
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">Start a conversation</CardTitle>
        {linkedFamilies.length > 0 && (
          <div>
            <FieldLabel>Connected family (links to their inbox)</FieldLabel>
            <NativeSelect
              value={linkedParentId ? linkedFamilies.find((f) => f.parentUserId === linkedParentId)?.id ?? "" : ""}
              onChange={(e) => pickFamily(e.target.value)}
            >
              <option value="">Manual entry…</option>
              {linkedFamilies.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.parentAccountName ?? "Family"} · {f.childName}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Parent name</FieldLabel>
            <Input
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g. Jordan Lee"
            />
          </div>
          <div>
            <FieldLabel>Child name</FieldLabel>
            <Input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="e.g. Maya"
            />
          </div>
        </div>
        <Button onClick={newThread}>
          <Plus className="size-4" /> New conversation
        </Button>
      </Card>

      {open ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {open.parentName} · {open.childName}
              </CardTitle>
              <CardHint>{open.classroomName}</CardHint>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenId(null)}>
              <X className="size-4" /> Close
            </Button>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-border bg-surface p-3">
            {open.messages.length === 0 ? (
              <p className="text-sm text-muted">
                No messages yet — say hello to start the conversation.
              </p>
            ) : (
              open.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    m.from === "teacher"
                      ? "ml-auto bg-accent text-white"
                      : "bg-ink/5",
                  )}
                >
                  <p>{m.text}</p>
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      m.from === "teacher" ? "text-white/70" : "text-muted",
                    )}
                  >
                    {m.from === "teacher" ? "You" : open.parentName} ·{" "}
                    {formatWhen(m.at)}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a message…"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <Button onClick={send}>Send</Button>
          </div>
        </Card>
      ) : visible.length === 0 ? (
        <EmptyHint text="No family conversations yet." />
      ) : (
        <div className="space-y-2">
          {visible.map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setOpenId(t.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">
                    {t.parentName} · {t.childName}
                  </p>
                  <span className="text-xs text-muted">{formatWhen(t.updatedAt)}</span>
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  {last
                    ? `${last.from === "teacher" ? "You" : t.parentName}: ${last.text}`
                    : "No messages yet"}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

function TeacherSettings() {
  const teacherName = useTeacher((s) => s.teacherName);
  const setTeacherName = useTeacher((s) => s.setTeacherName);
  const resetDemo = useTeacher((s) => s.resetDemo);
  const [name, setName] = useState(teacherName);

  return (
    <div className="space-y-5">
      <SectionHeader eyebrow="Settings" title="Teacher settings" />
      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">Profile</CardTitle>
        <div>
          <FieldLabel>Display name</FieldLabel>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              variant="secondary"
              onClick={() => {
                setTeacherName(name);
                toast.success("Profile updated");
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Card>
      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">Demo data</CardTitle>
        <CardHint>
          Resets classrooms, students, assignments, submissions, connections, and
          classroom Units back to the starter curriculum.
        </CardHint>
        <Button
          variant="outline"
          onClick={() => {
            resetDemo();
            toast.message("Teacher workspace reset");
          }}
        >
          <RotateCcw className="size-4" /> Reset demo
        </Button>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Child side: classroom                                               */
/* ------------------------------------------------------------------ */

export function ChildClassroom() {
  const childName = useLedger((s) => s.childName);
  const setScreen = useLedger((s) => s.setScreen);
  const classrooms = useTeacher((s) => s.classrooms);
  const students = useTeacher((s) => s.students);
  const assignments = useTeacher((s) => s.assignments);
  const submissions = useTeacher((s) => s.submissions);
  const classroomUnitBalance = useTeacher((s) => s.classroomUnitBalance);
  const joinClassroom = useTeacher((s) => s.joinClassroom);
  const submitAssignment = useTeacher((s) => s.submitAssignment);

  const [code, setCode] = useState("");
  const [name, setName] = useState(childName);
  const [workText, setWorkText] = useState<Record<string, string>>({});

  const myClassroomIds = useMemo(
    () =>
      classrooms
        .filter((c) =>
          students.some(
            (s) =>
              s.classroomId === c.id &&
              s.name.toLowerCase() === childName.toLowerCase(),
          ),
        )
        .map((c) => c.id),
    [classrooms, students, childName],
  );

  const myAssignments = assignments.filter(
    (a) => myClassroomIds.includes(a.classroomId) && a.status === "active",
  );

  const myUnits = students
    .filter((s) => s.name.toLowerCase() === childName.toLowerCase())
    .reduce((sum, s) => sum + classroomUnitBalance(s.id), 0);

  return (
    <div className="screen-enter space-y-4">
      <header>
        <p className="text-sm font-medium text-muted">Classroom</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          My classes
        </h1>
        <p className="mt-1 text-sm text-muted">
          Lessons and assignments from your teacher. Classroom Units are separate
          from your family Units.
        </p>
      </header>

      <LiveChalkboardBanner />

      {(() => {
        const me = students.find(
          (st) => st.name.toLowerCase() === childName.toLowerCase(),
        );
        const cid = me?.classroomId ?? myClassroomIds[0];
        if (!me || !cid) return null;
        return (
          <StudentClassroomExtras
            classroomId={cid}
            studentId={me.id}
            studentName={me.name}
          />
        );
      })()}

      <Card className="bg-vault p-5 text-vault-foreground">
        <p className="text-xs font-medium uppercase tracking-wider text-vault-foreground/60">
          My classroom Units
        </p>
        <p className="mt-1 font-display text-4xl font-semibold tabular-nums">
          {myUnits}
        </p>
        <p className="mt-1 text-sm text-vault-foreground/75">
          Educational rewards from teachers
        </p>
      </Card>

      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">Join a classroom</CardTitle>
        <CardHint>
          Classrooms are connected from the parent side — ask your parent to
          enter the teacher's join code in the parent app under Teachers.
        </CardHint>
        <p className="text-sm text-muted">
          Once your parent connects a classroom, your lessons and assignments
          will appear here.
        </p>
      </Card>

      {myClassroomIds.length === 0 ? (
        <EmptyHint text="You are not in any classroom yet — ask your parent to connect one." />
      ) : (
        <div className="space-y-3">
          {classrooms
            .filter((c) => myClassroomIds.includes(c.id))
            .map((c) => (
              <Card key={c.id} className="p-4">
                <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                <p className="text-xs text-muted">
                  {[c.gradeLevel, c.subject].filter(Boolean).join(" · ")}
                </p>
                {c.announcements.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {c.announcements.slice(0, 2).map((a) => (
                      <p key={a.id} className="rounded-lg bg-surface-2 p-2 text-sm">
                        <Megaphone className="mr-1 inline size-3.5" />
                        {a.text}
                      </p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3">
                  <ChildLeaderboardCard
                    classroomId={c.id}
                    classroomName={c.name}
                    childName={childName}
                  />
                </div>
              </Card>
            ))}
        </div>
      )}

      {myAssignments.length > 0 ? (
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Assignments to do</h2>
          {myAssignments.map((a) => {
            const mySubs = submissions.filter(
              (s) =>
                s.assignmentId === a.id &&
                s.studentName.toLowerCase() === childName.toLowerCase(),
            );
            const latest = mySubs[0];
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{a.title}</h3>
                    <p className="mt-1 text-sm text-muted">{a.instructions}</p>
                    <p className="mt-1 text-xs text-muted">
                      {a.dueDate ? `Due ${a.dueDate} · ` : ""}
                      {a.unitReward > 0 ? `+${a.unitReward} classroom Units on completion` : ""}
                      {a.kind === "creative" ? " · Creative Studio" : ""}
                    </p>
                  </div>
                  {latest ? (
                    <Badge
                      tone={
                        latest.status === "complete"
                          ? "accent"
                          : latest.status === "reviewed"
                            ? "warn"
                            : "muted"
                      }
                    >
                      {latest.status}
                    </Badge>
                  ) : null}
                </div>
                {latest?.feedback ? (
                  <p className="mt-2 rounded-lg bg-surface-2 p-2 text-sm">
                    Teacher feedback: {latest.feedback}
                  </p>
                ) : null}
                {!latest || latest.status !== "complete" ? (
                  <div className="mt-3 space-y-2">
                    <FieldLabel>My work</FieldLabel>
                    <Input
                      value={workText[a.id] ?? ""}
                      onChange={(e) =>
                        setWorkText((w) => ({ ...w, [a.id]: e.target.value }))
                      }
                      placeholder="Write your answer or describe your creation…"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const err = submitAssignment(a.id, childName, workText[a.id] ?? "");
                        if (err) toast.error(err);
                        else {
                          setWorkText((w) => ({ ...w, [a.id]: "" }));
                          toast.success("Submitted to your teacher");
                        }
                      }}
                    >
                      Submit work
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      <Button variant="outline" className="w-full" onClick={() => setScreen("home")}>
        Back to my ledger
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Parent side: teacher connections                                    */
/* ------------------------------------------------------------------ */

function connectionTone(status: TeacherConnection["status"]) {
  return status === "approved" ? "accent" : status === "pending" ? "warn" : "muted";
}

export function ParentTeachers() {
  const childName = useLedger((s) => s.childName);
  const connections = useTeacher((s) => s.connections);
  const requestConnection = useTeacher((s) => s.requestConnection);
  const disconnectConnection = useTeacher((s) => s.disconnectConnection);
  const setConnectionPermissions = useTeacher((s) => s.setConnectionPermissions);

  const [code, setCode] = useState("");
  const [name, setName] = useState(childName);

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Teachers"
        title="Classroom connections"
        text="Authorize your child's participation in teacher classrooms. You stay in control — approve, limit, or disconnect anytime."
      />

      <Card className="space-y-3 p-4">
        <CardTitle className="text-base">Connect a classroom</CardTitle>
        <CardHint>
          Ask the teacher for the classroom join code, then request the connection.
        </CardHint>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <FieldLabel>Join code</FieldLabel>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
            />
          </div>
          <div>
            <FieldLabel>Child name</FieldLabel>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={() => {
            const err = requestConnection(code, name);
            if (err) toast.error(err);
            else {
              setCode("");
              toast.success("Connection requested — the teacher will approve it");
            }
          }}
        >
          Request connection
        </Button>
      </Card>

      {connections.length === 0 ? (
        <EmptyHint text="No classroom connections yet." />
      ) : (
        <div className="grid gap-3">
          {connections.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{c.classroomName}</h2>
                  <p className="text-xs text-muted">
                    {c.childName} · requested {formatWhen(c.requestedAt)}
                  </p>
                </div>
                <Badge tone={connectionTone(c.status)}>{c.status}</Badge>
              </div>

              {c.status !== "disconnected" ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Educational permissions — lessons, assignments, progress</span>
                    <input
                      type="checkbox"
                      checked={c.educationalPermissions}
                      onChange={(e) =>
                        setConnectionPermissions(c.id, {
                          educationalPermissions: e.target.checked,
                          unitPermissions: c.unitPermissions,
                        })
                      }
                      className="size-4 accent-accent"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span>Allow classroom Unit rewards</span>
                    <input
                      type="checkbox"
                      checked={c.unitPermissions}
                      onChange={(e) =>
                        setConnectionPermissions(c.id, {
                          educationalPermissions: c.educationalPermissions,
                          unitPermissions: e.target.checked,
                        })
                      }
                      className="size-4 accent-accent"
                    />
                  </label>
                  <p className="text-xs text-muted">
                    Teachers only see educational data — never family balances or
                    private financial activity.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      disconnectConnection(c.id);
                      toast.message("Classroom disconnected");
                    }}
                  >
                    Disconnect classroom
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <ParentLeaderboardOptIn childName={childName} />
      <ParentTeacherMessages childName={childName} />
    </div>
  );
}

function ParentTeacherMessages({ childName }: { childName: string }) {
  const threads = useTeacher((s) => s.threads);
  const sendThreadMessage = useTeacher((s) => s.sendThreadMessage);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const mine = useMemo(
    () =>
      threads.filter(
        (t) => t.childName.toLowerCase() === childName.trim().toLowerCase(),
      ),
    [threads, childName],
  );
  const open = mine.find((t) => t.id === openId) ?? null;

  function send() {
    if (!open) return;
    const err = sendThreadMessage(open.id, "parent", reply);
    if (err) toast.error(err);
    else setReply("");
  }

  return (
    <div className="space-y-3">
      <SectionHeader
        eyebrow="Messages"
        title="Messages with teachers"
        text="Private two-way conversations with your child's teachers."
      />
      {open ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{open.classroomName}</CardTitle>
              <CardHint>
                {open.childName} · started {formatWhen(open.updatedAt)}
              </CardHint>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenId(null)}>
              <X className="size-4" /> Close
            </Button>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto rounded-xl border border-border bg-surface p-3">
            {open.messages.length === 0 ? (
              <p className="text-sm text-muted">No messages yet.</p>
            ) : (
              open.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                    m.from === "parent"
                      ? "ml-auto bg-accent text-white"
                      : "bg-ink/5",
                  )}
                >
                  <p>{m.text}</p>
                  <p
                    className={cn(
                      "mt-1 text-[11px]",
                      m.from === "parent" ? "text-white/70" : "text-muted",
                    )}
                  >
                    {m.from === "parent" ? "You" : "Teacher"} · {formatWhen(m.at)}
                  </p>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a message…"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <Button onClick={send}>Send</Button>
          </div>
        </Card>
      ) : mine.length === 0 ? (
        <EmptyHint text="No teacher conversations yet. Your child's teacher can start one from their Messages tab." />
      ) : (
        <div className="space-y-2">
          {mine.map((t) => {
            const last = t.messages[t.messages.length - 1];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setOpenId(t.id)}
                className="w-full rounded-xl border border-border bg-card p-4 text-left hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{t.classroomName}</p>
                  <span className="text-xs text-muted">{formatWhen(t.updatedAt)}</span>
                </div>
                <p className="mt-1 truncate text-sm text-muted">
                  {last
                    ? `${last.from === "parent" ? "You" : "Teacher"}: ${last.text}`
                    : "No messages yet"}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* Re-exported icon map for nav construction in pillarpath-app */
export const teacherNavIcons = {
  dashboard: LayoutDashboard,
  classes: Users,
  lessons: BookOpen,
  assignments: ClipboardList,
  students: GraduationCap,
  units: Coins,
  progress: LineChart,
  leaderboard: Trophy,
  studio: Palette,
  resources: Library,
  library: FolderOpen,
  records: FileSpreadsheet,
  messages: MessageSquare,
  chalkboard: Presentation,
  deskchart: Armchair,
  settings: SettingsIcon,
};

export const teacherNavLabels: Record<TeacherSection, string> = {
  dashboard: "Dashboard",
  classes: "My Classes",
  lessons: "Lessons",
  assignments: "Assignments",
  students: "Students",
  units: "Classroom Units",
  progress: "Progress",
  leaderboard: "Leaderboard",
  studio: "Creative Studio",
  resources: "Resources",
  library: "Library",
  records: "Records",
  messages: "Messages",
  chalkboard: "Chalkboard",
  deskchart: "Desk Chart",
  settings: "Settings",
};
