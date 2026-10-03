import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";
import {
  CLASSROOM_ACTIVITY_SEED,
  type ClassroomActivityTemplate,
} from "@/lib/chores";
import * as teacherApi from "@/lib/teacher-server";

/* ------------------------------------------------------------------ */
/* PillarPath Teacher Workspace store                                   */
/*                                                                      */
/* Classroom Units are INTENTIONALLY separate from family Units.        */
/* Teachers only ever see educational data (names, assignments,         */
/* progress, classroom Units) — never family balances, bank info, or    */
/* private marketplace transactions. See Master Manual sections 17, 24.*/
/*                                                                      */
/* Write-through sync: every mutator applies the change locally right   */
/* away (optimistic), then fires the matching server function in the    */
/* background. On success, server-generated values (join codes,         */
/* timestamps, balances) are patched in; on failure the pre-mutation   */
/* snapshot is restored and a toast explains what happened. Actions     */
/* stay synchronous so UI call sites are unchanged.                     */
/* ------------------------------------------------------------------ */

export type TeacherClassroom = {
  id: string;
  name: string;
  gradeLevel: string;
  subject: string;
  joinCode: string;
  studentIds: string[];
  announcements: Array<{ id: string; text: string; at: string }>;
  createdAt: string;
};

export type TeacherStudent = {
  id: string;
  name: string;
  classroomId: string;
  joinedAt: string;
};

export type TeacherLesson = {
  id: string;
  module: string;
  title: string;
  description: string;
  objective: string;
  instructions: string;
  materials: string;
  questions: string;
  completionRequirements: string;
  unitReward: number;
  dueDate: string;
  createdAt: string;
  seeded?: boolean;
};

export type TeacherAssignment = {
  id: string;
  classroomId: string;
  title: string;
  instructions: string;
  attachmentsNote: string;
  dueDate: string;
  scoringCriteria: string;
  unitReward: number;
  kind: "standard" | "creative";
  status: "active" | "closed";
  createdAt: string;
};

export type SubmissionStatus = "submitted" | "reviewed" | "complete";

export type TeacherSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  text: string;
  submittedAt: string;
  status: SubmissionStatus;
  feedback: string;
  unitsAwarded: number;
};

export type ConnectionStatus = "pending" | "approved" | "disconnected";

export type TeacherConnection = {
  id: string;
  classroomId: string;
  classroomName: string;
  childName: string;
  status: ConnectionStatus;
  educationalPermissions: boolean;
  unitPermissions: boolean;
  requestedAt: string;
  parentUserId: string | null;
  parentAccountName: string | null;
};

export type TeacherMessage = {
  id: string;
  audience: string;
  text: string;
  at: string;
};

/* Teacher <-> parent two-way messaging. Threads are keyed to one family   */
/* (parent + child) inside a classroom. The data model is server-ready:   */
/* when real accounts land, threads sync by family id.                    */
export type ThreadSender = "teacher" | "parent";

export type TeacherThreadMessage = {
  id: string;
  from: ThreadSender;
  text: string;
  at: string;
};

export type TeacherThread = {
  id: string;
  classroomId: string;
  classroomName: string;
  parentName: string;
  childName: string;
  messages: TeacherThreadMessage[];
  updatedAt: string;
};

export type ClassroomUnitEvent = {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  note: string;
  at: string;
};

export type TeacherResource = {
  id: string;
  title: string;
  kind: string;
  description: string;
};

const STORAGE_KEY = "pillarpath-teacher-v1";

function nowIso() {
  return new Date().toISOString();
}

function makeJoinCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

const CURRICULUM: Array<
  Pick<
    TeacherLesson,
    | "module"
    | "title"
    | "description"
    | "objective"
    | "instructions"
    | "materials"
    | "questions"
    | "completionRequirements"
    | "unitReward"
  >
> = [
  {
    module: "Module 1",
    title: "What Is Money?",
    description: "Understanding money and exchange.",
    objective:
      "Students can explain what money is and why people use it instead of trading items directly.",
    instructions:
      "Read the starter material, then complete the barter-versus-money worksheet with a partner.",
    materials: "Worksheet: barter vs. money scenarios",
    questions: "Why is trading toys directly sometimes hard? What makes money useful?",
    completionRequirements: "Complete the worksheet and answer the reflection question.",
    unitReward: 5,
  },
  {
    module: "Module 2",
    title: "Earning",
    description: "How people earn income.",
    objective:
      "Students can name three ways people earn and connect effort to income.",
    instructions:
      "List jobs in your community, then rank them by the skills they need and what they might pay.",
    materials: "Job cards handout",
    questions: "What is the difference between a wage and a salary?",
    completionRequirements: "Finish the job-ranking chart.",
    unitReward: 5,
  },
  {
    module: "Module 3",
    title: "Saving",
    description: "Why people save.",
    objective:
      "Students can explain why saving matters and set a small savings target.",
    instructions:
      "Pick something you want, find its price in Units, and build a two-week savings plan.",
    materials: "Savings plan template",
    questions: "What is the difference between saving and not spending?",
    completionRequirements: "Submit a savings plan with a target and timeline.",
    unitReward: 10,
  },
  {
    module: "Module 4",
    title: "Spending",
    description: "Needs, wants, and choices.",
    objective:
      "Students can sort items into needs and wants and explain tradeoffs.",
    instructions:
      "Sort 20 item cards into needs and wants, then defend three tricky choices in writing.",
    materials: "Needs vs. wants card deck",
    questions: "Is a bicycle a need or a want? Does it depend on the situation?",
    completionRequirements: "Sorted deck plus three written defenses.",
    unitReward: 5,
  },
  {
    module: "Module 5",
    title: "Budgeting",
    description: "Planning where money goes.",
    objective:
      "Students can build a simple budget that balances income and spending.",
    instructions:
      "You receive 100 classroom Units. Allocate them across housing, food, transport, savings, and fun — the total must equal 100.",
    materials: "Budget grid",
    questions: "What did you cut first when the numbers did not fit?",
    completionRequirements: "A balanced budget with a one-paragraph reflection.",
    unitReward: 10,
  },
  {
    module: "Module 6",
    title: "Goals",
    description: "Setting financial objectives.",
    objective:
      "Students can write a SMART-style goal and break it into weekly steps.",
    instructions:
      "Choose a goal, make it specific and time-bound, then list the weekly steps to reach it.",
    materials: "Goal worksheet",
    questions: "Why do vague goals fail more often than specific ones?",
    completionRequirements: "One written goal with weekly steps.",
    unitReward: 10,
  },
  {
    module: "Module 7",
    title: "Banking Concepts",
    description: "Basic understanding of accounts and financial institutions.",
    objective:
      "Students can describe what banks do and the difference between checking and savings.",
    instructions:
      "Match banking terms to definitions, then explain where the Savings Vault fits.",
    materials: "Banking vocabulary sheet",
    questions: "Why might someone keep money in two different accounts?",
    completionRequirements: "Completed vocabulary sheet.",
    unitReward: 5,
  },
  {
    module: "Module 8",
    title: "Investing Concepts",
    description: "Basic education about markets and risk.",
    objective:
      "Students can explain risk, diversification, and why prices move — as concepts, not advice.",
    instructions:
      "Run the classroom market simulation for five rounds and record what happened to prices.",
    materials: "Market simulation board",
    questions: "What does it mean to diversify? Why does it lower risk?",
    completionRequirements: "Simulation log with five rounds recorded.",
    unitReward: 10,
  },
  {
    module: "Module 9",
    title: "Entrepreneurship",
    description: "Creating value and running a business.",
    objective:
      "Students can sketch a simple business idea with a customer, a price, and a cost.",
    instructions:
      "Design a one-page business plan and a poster for your idea (Creative Studio).",
    materials: "Business plan template",
    questions: "Who is your customer, and why would they pay?",
    completionRequirements: "One-page plan plus a poster.",
    unitReward: 15,
  },
  {
    module: "Module 10",
    title: "Long-Term Planning",
    description: "Preparing for future goals.",
    objective:
      "Students can connect today's choices to a goal five years away.",
    instructions:
      "Write a letter to your future self describing the financial habits you want to keep.",
    materials: "Letter template",
    questions: "Which habit from this course will matter most in five years?",
    completionRequirements: "A completed letter.",
    unitReward: 10,
  },
];

const RESOURCES: TeacherResource[] = [
  { id: "res-1", title: "Needs vs. Wants card deck", kind: "Worksheet", description: "20 printable item cards for sorting activities." },
  { id: "res-2", title: "Weekly budget grid", kind: "Worksheet", description: "100-Unit allocation grid used in the budgeting lesson." },
  { id: "res-3", title: "Savings plan template", kind: "Worksheet", description: "Target, timeline, and weekly checkpoints." },
  { id: "res-4", title: "Market simulation board", kind: "Classroom game", description: "Five-round price-movement simulation for Module 8." },
  { id: "res-5", title: "Business plan one-pager", kind: "Project", description: "Customer, price, cost, and poster prompt for Module 9." },
  { id: "res-6", title: "Discussion prompts: spending choices", kind: "Discussion", description: "Ten prompts for circle-time conversations about tradeoffs." },
];

function seedLessons(): TeacherLesson[] {
  return CURRICULUM.map((c) => ({
    ...c,
    id: crypto.randomUUID(),
    dueDate: "",
    createdAt: nowIso(),
    seeded: true,
  }));
}

type TeacherData = {
  teacherName: string;
  classrooms: TeacherClassroom[];
  students: TeacherStudent[];
  lessons: TeacherLesson[];
  assignments: TeacherAssignment[];
  submissions: TeacherSubmission[];
  connections: TeacherConnection[];
  messages: TeacherMessage[];
  threads: TeacherThread[];
  classroomUnitBalances: Record<string, number>;
  unitEvents: ClassroomUnitEvent[];
  resources: TeacherResource[];
  earningActivities: ClassroomActivityTemplate[];
};

type TeacherState = TeacherData & {
  _syncing: boolean;
  _loadError: string | null;
  loadFromServer: () => Promise<void>;
  setTeacherName: (name: string) => void;
  createClassroom: (input: {
    name: string;
    gradeLevel: string;
    subject: string;
  }) => TeacherClassroom;
  addStudent: (classroomId: string, name: string) => string | null;
  removeClassroomStudent: (studentId: string) => void;
  joinClassroom: (joinCode: string, studentName: string) => string | null;
  addAnnouncement: (classroomId: string, text: string) => void;
  createLesson: (
    input: Omit<TeacherLesson, "id" | "createdAt" | "seeded">,
  ) => string | null;
  updateLesson: (
    id: string,
    input: Partial<Omit<TeacherLesson, "id" | "createdAt" | "seeded">>,
  ) => string | null;
  deleteLesson: (id: string) => void;
  createAssignment: (
    input: Omit<TeacherAssignment, "id" | "createdAt" | "status">,
  ) => string | null;
  updateAssignment: (
    id: string,
    input: Partial<Omit<TeacherAssignment, "id" | "createdAt" | "status">>,
  ) => string | null;
  deleteAssignment: (id: string) => void;
  closeAssignment: (id: string) => void;
  submitAssignment: (
    assignmentId: string,
    studentName: string,
    text: string,
  ) => string | null;
  reviewSubmission: (
    id: string,
    input: { feedback: string; status: SubmissionStatus; awardUnits: number },
  ) => string | null;
  awardClassroomUnits: (
    studentId: string,
    amount: number,
    note: string,
  ) => string | null;
  requestConnection: (joinCode: string, childName: string) => string | null;
  approveConnection: (id: string) => void;
  denyConnection: (id: string) => void;
  disconnectConnection: (id: string) => void;
  setConnectionPermissions: (
    id: string,
    input: { educationalPermissions: boolean; unitPermissions: boolean },
  ) => void;
  sendMessage: (audience: string, text: string) => string | null;
  startThread: (
    classroomId: string,
    parentName: string,
    childName: string,
    parentUserId?: string | null,
  ) => string | null;
  sendThreadMessage: (
    threadId: string,
    from: ThreadSender,
    text: string,
  ) => string | null;
  importRoster: (
    classroomId: string,
    names: string[],
  ) => { imported: number; skipped: number };
  classroomUnitBalance: (studentId: string) => number;
  addEarningActivity: (input: {
    name: string;
    amount: number;
    hint: string;
  }) => string | null;
  updateEarningActivity: (
    id: string,
    input: { name: string; amount: number; hint: string },
  ) => string | null;
  removeEarningActivity: (id: string) => void;
  resetDemo: () => void;
};

function snapshotData(s: TeacherState): TeacherData {
  return {
    teacherName: s.teacherName,
    classrooms: s.classrooms,
    students: s.students,
    lessons: s.lessons,
    assignments: s.assignments,
    submissions: s.submissions,
    connections: s.connections,
    messages: s.messages,
    threads: s.threads,
    classroomUnitBalances: s.classroomUnitBalances,
    unitEvents: s.unitEvents,
    resources: s.resources,
    earningActivities: s.earningActivities,
  };
}

export const useTeacher = create<TeacherState>()(
  persist(
    (set, get) => {
      /** Capture the pre-mutation slices; returns a rollback that restores
       *  them and toasts the failure so the UI never silently diverges. */
      const beginSync = () => {
        const snapshot = snapshotData(get());
        return (message: string) => {
          set(snapshot);
          toast.error(message);
        };
      };

      /** Optimistic-then-sync helper for mutators that don't need to patch
       *  server-generated values back in. */
      const syncInBackground = (
        apply: () => void,
        call: () => Promise<unknown>,
        failureMessage: string,
      ) => {
        const rollback = beginSync();
        apply();
        void (async () => {
          try {
            await call();
          } catch {
            rollback(failureMessage);
          }
        })();
      };

      const pushConnectionStatus = (
        id: string,
        status: "approved" | "disconnected",
        failureMessage: string,
      ) => {
        syncInBackground(
          () =>
            set((s) => ({
              connections: s.connections.map((c) =>
                c.id === id ? { ...c, status } : c,
              ),
            })),
          () => teacherApi.setClassroomConnectionStatus({ data: { id, status } }),
          failureMessage,
        );
      };

      return {
        teacherName: "Ms. Rivera",
        classrooms: [],
        students: [],
        lessons: seedLessons(),
        assignments: [],
        submissions: [],
        connections: [],
        messages: [],
        threads: [],
        classroomUnitBalances: {},
        unitEvents: [],
        resources: RESOURCES,
        earningActivities: CLASSROOM_ACTIVITY_SEED.map((a) => ({ ...a })),
        _syncing: false,
        _loadError: null,

        loadFromServer: async () => {
          set({ _syncing: true, _loadError: null });
          try {
            const w = await teacherApi.loadTeacherWorkspace();
            set({
              teacherName: w.teacherName,
              classrooms: w.classrooms.map((c) => ({
                id: c.id,
                name: c.name,
                gradeLevel: c.gradeLevel,
                subject: c.subject,
                joinCode: c.joinCode,
                studentIds: [...c.studentIds],
                announcements: c.announcements.map((a) => ({
                  id: a.id,
                  text: a.text,
                  at: a.at,
                })),
                createdAt: c.createdAt,
              })),
              students: w.students.map((s) => ({
                id: s.id,
                name: s.name,
                classroomId: s.classroomId,
                joinedAt: s.joinedAt,
              })),
              lessons: w.lessons.map((l) => ({
                id: l.id,
                module: l.module ?? "",
                title: l.title,
                description: l.description ?? "",
                objective: l.objective ?? "",
                instructions: l.instructions ?? "",
                materials: l.materials ?? "",
                questions: l.questions ?? "",
                completionRequirements: l.completionRequirements ?? "",
                unitReward: l.unitReward ?? 0,
                dueDate: l.dueDate ?? "",
                createdAt: l.createdAt,
              })),
              assignments: w.assignments.map((a) => ({
                id: a.id,
                classroomId: a.classroomId,
                title: a.title,
                instructions: a.instructions ?? a.description ?? "",
                attachmentsNote: a.materials ?? "",
                dueDate: a.dueDate ?? "",
                scoringCriteria: a.rubric ?? "",
                unitReward: a.unitReward ?? 0,
                kind: (a.isCreative ? "creative" : "standard") as "standard" | "creative",
                status: (a.status === "closed" ? "closed" : "active") as "active" | "closed",
                createdAt: a.createdAt,
              })),
              submissions: w.submissions.map((s) => ({
                id: s.id,
                assignmentId: s.assignmentId,
                studentId: s.studentId,
                studentName: s.studentName,
                text: s.body,
                submittedAt: s.submittedAt,
                status: (s.status === "reviewed" || s.status === "complete"
                  ? s.status
                  : "submitted") as SubmissionStatus,
                feedback: s.feedback ?? "",
                unitsAwarded: s.unitsAwarded ?? 0,
              })),
              connections: w.connections.map((c) => ({
                id: c.id,
                classroomId: c.classroomId,
                classroomName: c.classroomName,
                childName: c.childName,
                status: (c.status === "approved" || c.status === "disconnected"
                  ? c.status
                  : "pending") as ConnectionStatus,
                educationalPermissions: c.educationalPermissions,
                unitPermissions: c.unitPermissions,
                parentUserId: c.parentUserId ?? null,
                parentAccountName: c.parentAccountName ?? null,
                requestedAt: c.requestedAt,
              })),
              messages: w.messages.map((m) => ({
                id: m.id,
                audience: m.audience,
                text: m.text,
                at: m.at,
              })),
              threads: w.threads.map((t) => ({
                id: t.id,
                classroomId: t.classroomId,
                classroomName: t.classroomName,
                parentName: t.parentName,
                childName: t.childName,
                messages: t.messages.map((m) => ({
                  id: m.id,
                  from: (m.from === "parent" ? "parent" : "teacher") as ThreadSender,
                  text: m.text,
                  at: m.at,
                })),
                updatedAt: t.updatedAt,
              })),
              classroomUnitBalances: { ...w.classroomUnitBalances },
              unitEvents: w.unitEvents.map((e) => ({
                id: e.id,
                studentId: e.studentId,
                studentName: e.studentName,
                amount: e.amount,
                note: e.note,
                at: e.at,
              })),
              earningActivities: w.activities.map((a) => ({
                id: a.id,
                name: a.name,
                amount: a.amount,
                hint: a.hint ?? "",
              })),
              _syncing: false,
              _loadError: null,
            });
          } catch (e) {
            // Keep the existing local data — a failed load must never wipe it.
            set({
              _syncing: false,
              _loadError:
                e instanceof Error ? e.message : "Could not load the teacher workspace",
            });
          }
        },

        setTeacherName: (name) => {
          const next = name.trim() || "Teacher";
          syncInBackground(
            () => set({ teacherName: next }),
            () => teacherApi.setTeacherName({ data: { name: next } }),
            "Could not save the teacher name",
          );
        },

        createClassroom: (input) => {
          const rollback = beginSync();
          const classroom: TeacherClassroom = {
            id: crypto.randomUUID(),
            name: input.name.trim(),
            gradeLevel: input.gradeLevel.trim(),
            subject: input.subject.trim(),
            joinCode: makeJoinCode(),
            studentIds: [],
            announcements: [],
            createdAt: nowIso(),
          };
          set((s) => ({ classrooms: [classroom, ...s.classrooms] }));
          void (async () => {
            try {
              const res = await teacherApi.createClassroom({
                data: {
                  id: classroom.id,
                  name: classroom.name,
                  gradeLevel: classroom.gradeLevel,
                  subject: classroom.subject,
                },
              });
              if (res.joinCode) {
                set((s) => ({
                  classrooms: s.classrooms.map((c) =>
                    c.id === classroom.id ? { ...c, joinCode: res.joinCode } : c,
                  ),
                }));
              }
            } catch {
              rollback("Could not create the classroom");
            }
          })();
          return classroom;
        },

        addStudent: (classroomId, name) => {
          const trimmed = name.trim();
          if (!trimmed) return "Enter a student name";
          const classroom = get().classrooms.find((c) => c.id === classroomId);
          if (!classroom) return "Classroom not found";
          const rollback = beginSync();
          const student: TeacherStudent = {
            id: crypto.randomUUID(),
            name: trimmed,
            classroomId,
            joinedAt: nowIso(),
          };
          set((s) => ({
            students: [student, ...s.students],
            classrooms: s.classrooms.map((c) =>
              c.id === classroomId
                ? { ...c, studentIds: [student.id, ...c.studentIds] }
                : c,
            ),
          }));
          void (async () => {
            try {
              const res = await teacherApi.addClassroomStudent({
                data: { id: student.id, classroomId, name: trimmed },
              });
              if (res.joinedAt) {
                set((s) => ({
                  students: s.students.map((st) =>
                    st.id === student.id ? { ...st, joinedAt: res.joinedAt } : st,
                  ),
                }));
              }
            } catch {
              rollback("Could not enroll the student");
            }
          })();
          return null;
        },

        removeClassroomStudent: (studentId) => {
          syncInBackground(
            () =>
              set((s) => ({
                students: s.students.filter((st) => st.id !== studentId),
                classrooms: s.classrooms.map((c) => ({
                  ...c,
                  studentIds: c.studentIds.filter((id) => id !== studentId),
                })),
              })),
            () => teacherApi.removeClassroomStudent({ data: { studentId } }),
            "Could not remove the student",
          );
        },

        joinClassroom: (joinCode, studentName) => {
          const code = joinCode.trim().toUpperCase();
          const trimmed = studentName.trim();
          if (!code || !trimmed) return "Enter the join code and the student's name";
          const classroom = get().classrooms.find((c) => c.joinCode === code);
          if (!classroom) return "No classroom uses that join code";
          if (
            get().students.some(
              (s) =>
                s.classroomId === classroom.id &&
                s.name.toLowerCase() === trimmed.toLowerCase(),
            )
          ) {
            return "That name is already enrolled in this classroom";
          }
          const rollback = beginSync();
          const student: TeacherStudent = {
            id: crypto.randomUUID(),
            name: trimmed,
            classroomId: classroom.id,
            joinedAt: nowIso(),
          };
          set((s) => ({
            students: [student, ...s.students],
            classrooms: s.classrooms.map((c) =>
              c.id === classroom.id
                ? { ...c, studentIds: [student.id, ...c.studentIds] }
                : c,
            ),
          }));
          void (async () => {
            try {
              const res = await teacherApi.enrollStudentByCode({
                data: { id: student.id, code, studentName: trimmed },
              });
              set((s) => ({
                students: s.students.map((st) =>
                  st.id === student.id
                    ? { ...st, classroomId: res.classroomId ?? st.classroomId }
                    : st,
                ),
              }));
            } catch {
              rollback("Could not join the classroom");
            }
          })();
          return null;
        },

        addAnnouncement: (classroomId, text) => {
          const trimmed = text.trim();
          if (!trimmed) return;
          const rollback = beginSync();
          const announcement = { id: crypto.randomUUID(), text: trimmed, at: nowIso() };
          set((s) => ({
            classrooms: s.classrooms.map((c) =>
              c.id === classroomId
                ? {
                    ...c,
                    announcements: [announcement, ...c.announcements],
                  }
                : c,
            ),
          }));
          void (async () => {
            try {
              const res = await teacherApi.postAnnouncement({
                data: { id: announcement.id, classroomId, text: trimmed },
              });
              if (res.at) {
                set((s) => ({
                  classrooms: s.classrooms.map((c) =>
                    c.id === classroomId
                      ? {
                          ...c,
                          announcements: c.announcements.map((a) =>
                            a.id === announcement.id ? { ...a, at: res.at } : a,
                          ),
                        }
                      : c,
                  ),
                }));
              }
            } catch {
              rollback("Could not post the announcement");
            }
          })();
        },

        createLesson: (input) => {
          if (!input.title.trim()) return "Give the lesson a title";
          const rollback = beginSync();
          const lesson: TeacherLesson = {
            ...input,
            title: input.title.trim(),
            id: crypto.randomUUID(),
            createdAt: nowIso(),
          };
          set((s) => ({ lessons: [lesson, ...s.lessons] }));
          void (async () => {
            try {
              await teacherApi.createLesson({
                data: {
                  id: lesson.id,
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
                },
              });
            } catch {
              rollback("Could not create the lesson");
            }
          })();
          return null;
        },

        updateLesson: (id, input) => {
          const lesson = get().lessons.find((l) => l.id === id);
          if (!lesson) return "Lesson not found";
          const title = (input.title ?? lesson.title).trim();
          if (!title) return "Give the lesson a title";
          syncInBackground(
            () =>
              set((s) => ({
                lessons: s.lessons.map((l) =>
                  l.id === id ? { ...l, ...input, title, id: l.id } : l,
                ),
              })),
            () =>
              teacherApi.updateLesson({
                data: {
                  id,
                  module: input.module ?? lesson.module,
                  title,
                  description: input.description ?? lesson.description,
                  objective: input.objective ?? lesson.objective,
                  instructions: input.instructions ?? lesson.instructions,
                  materials: input.materials ?? lesson.materials,
                  questions: input.questions ?? lesson.questions,
                  completionRequirements:
                    input.completionRequirements ?? lesson.completionRequirements,
                  unitReward: input.unitReward ?? lesson.unitReward,
                  dueDate: input.dueDate ?? lesson.dueDate,
                },
              }),
            "Could not update the lesson",
          );
          return null;
        },

        deleteLesson: (id) => {
          syncInBackground(
            () => set((s) => ({ lessons: s.lessons.filter((l) => l.id !== id) })),
            () => teacherApi.deleteLesson({ data: { id } }),
            "Could not delete the lesson",
          );
        },

        createAssignment: (input) => {
          if (!input.title.trim()) return "Give the assignment a title";
          if (!input.classroomId) return "Choose a classroom";
          const rollback = beginSync();
          const assignment: TeacherAssignment = {
            ...input,
            title: input.title.trim(),
            id: crypto.randomUUID(),
            status: "active",
            createdAt: nowIso(),
          };
          set((s) => ({ assignments: [assignment, ...s.assignments] }));
          void (async () => {
            try {
              await teacherApi.createAssignment({
                data: {
                  id: assignment.id,
                  classroomId: assignment.classroomId,
                  title: assignment.title,
                  description: "",
                  instructions: assignment.instructions,
                  materials: assignment.attachmentsNote,
                  rubric: assignment.scoringCriteria,
                  dueDate: assignment.dueDate,
                  unitReward: assignment.unitReward,
                  isCreative: assignment.kind === "creative",
                },
              });
            } catch {
              rollback("Could not create the assignment");
            }
          })();
          return null;
        },

        updateAssignment: (id, input) => {
          const assignment = get().assignments.find((a) => a.id === id);
          if (!assignment) return "Assignment not found";
          const title = (input.title ?? assignment.title).trim();
          if (!title) return "Give the assignment a title";
          const kind = input.kind ?? assignment.kind;
          syncInBackground(
            () =>
              set((s) => ({
                assignments: s.assignments.map((a) =>
                  a.id === id ? { ...a, ...input, title, kind, id: a.id } : a,
                ),
              })),
            () =>
              teacherApi.updateAssignment({
                data: {
                  id,
                  title,
                  instructions: input.instructions ?? assignment.instructions,
                  materials: input.attachmentsNote ?? assignment.attachmentsNote,
                  rubric: input.scoringCriteria ?? assignment.scoringCriteria,
                  dueDate: input.dueDate ?? assignment.dueDate,
                  unitReward: input.unitReward ?? assignment.unitReward,
                  isCreative: kind === "creative",
                },
              }),
            "Could not update the assignment",
          );
          return null;
        },

        deleteAssignment: (id) => {
          syncInBackground(
            () =>
              set((s) => ({
                assignments: s.assignments.filter((a) => a.id !== id),
                submissions: s.submissions.filter((su) => su.assignmentId !== id),
              })),
            () => teacherApi.deleteAssignment({ data: { id } }),
            "Could not delete the assignment",
          );
        },

        closeAssignment: (id) => {
          syncInBackground(
            () =>
              set((s) => ({
                assignments: s.assignments.map((a) =>
                  a.id === id ? { ...a, status: "closed" as const } : a,
                ),
              })),
            () => teacherApi.closeAssignment({ data: { id } }),
            "Could not close the assignment",
          );
        },

        submitAssignment: (assignmentId, studentName, text) => {
          const assignment = get().assignments.find((a) => a.id === assignmentId);
          if (!assignment) return "Assignment not found";
          if (assignment.status !== "active") return "This assignment is closed";
          const trimmed = text.trim();
          if (!trimmed) return "Write your work before submitting";
          const name = studentName.trim();
          let student = get().students.find(
            (s) =>
              s.classroomId === assignment.classroomId &&
              s.name.toLowerCase() === name.toLowerCase(),
          );
          let createdStudent: TeacherStudent | null = null;
          if (!student) {
            if (!name) return "Enter a student name";
            createdStudent = {
              id: crypto.randomUUID(),
              name,
              classroomId: assignment.classroomId,
              joinedAt: nowIso(),
            };
            student = createdStudent;
          }
          const rollback = beginSync();
          const submission: TeacherSubmission = {
            id: crypto.randomUUID(),
            assignmentId,
            studentId: student.id,
            studentName: student.name,
            text: trimmed,
            submittedAt: nowIso(),
            status: "submitted",
            feedback: "",
            unitsAwarded: 0,
          };
          const fresh = createdStudent;
          set((s) => ({
            students: fresh ? [fresh, ...s.students] : s.students,
            classrooms: fresh
              ? s.classrooms.map((c) =>
                  c.id === assignment.classroomId
                    ? { ...c, studentIds: [fresh.id, ...c.studentIds] }
                    : c,
                )
              : s.classrooms,
            submissions: [submission, ...s.submissions],
          }));
          void (async () => {
            try {
              if (fresh) {
                const res = await teacherApi.addClassroomStudent({
                  data: { id: fresh.id, classroomId: fresh.classroomId, name: fresh.name },
                });
                if (res.joinedAt) {
                  set((st) => ({
                    students: st.students.map((x) =>
                      x.id === fresh.id ? { ...x, joinedAt: res.joinedAt } : x,
                    ),
                  }));
                }
              }
              const res = await teacherApi.logAssignmentSubmission({
                data: {
                  id: submission.id,
                  assignmentId,
                  studentId: student.id,
                  body: trimmed,
                },
              });
              if (res.submittedAt) {
                set((st) => ({
                  submissions: st.submissions.map((su) =>
                    su.id === submission.id ? { ...su, submittedAt: res.submittedAt } : su,
                  ),
                }));
              }
            } catch {
              rollback("Could not submit the assignment");
            }
          })();
          return null;
        },

        reviewSubmission: (id, input) => {
          const submission = get().submissions.find((s) => s.id === id);
          if (!submission) return "Submission not found";
          const assignment = get().assignments.find(
            (a) => a.id === submission.assignmentId,
          );
          const award =
            input.status === "complete" ? Math.max(0, Math.floor(input.awardUnits)) : 0;
          syncInBackground(
            () =>
              set((s) => ({
                submissions: s.submissions.map((sub) =>
                  sub.id === id
                    ? {
                        ...sub,
                        feedback: input.feedback.trim(),
                        status: input.status,
                        unitsAwarded: award,
                      }
                    : sub,
                ),
                classroomUnitBalances:
                  award > 0
                    ? {
                        ...s.classroomUnitBalances,
                        [submission.studentId]:
                          (s.classroomUnitBalances[submission.studentId] ?? 0) + award,
                      }
                    : s.classroomUnitBalances,
                unitEvents:
                  award > 0
                    ? [
                        {
                          id: crypto.randomUUID(),
                          studentId: submission.studentId,
                          studentName: submission.studentName,
                          amount: award,
                          note: `Assignment reward · ${assignment?.title ?? "assignment"}`,
                          at: nowIso(),
                        },
                        ...s.unitEvents,
                      ].slice(0, 100)
                    : s.unitEvents,
              })),
            () =>
              teacherApi.reviewAssignmentSubmission({
                data: {
                  id,
                  feedback: input.feedback.trim(),
                  status: input.status,
                  awardUnits: award,
                },
              }),
            "Could not save the review",
          );
          return null;
        },

        awardClassroomUnits: (studentId, amount, note) => {
          const student = get().students.find((s) => s.id === studentId);
          if (!student) return "Student not found";
          const amt = Math.max(1, Math.floor(amount));
          const cleanNote = note.trim() || "Classroom reward";
          const rollback = beginSync();
          const eventId = crypto.randomUUID();
          set((s) => ({
            classroomUnitBalances: {
              ...s.classroomUnitBalances,
              [studentId]: (s.classroomUnitBalances[studentId] ?? 0) + amt,
            },
            unitEvents: [
              {
                id: eventId,
                studentId,
                studentName: student.name,
                amount: amt,
                note: cleanNote,
                at: nowIso(),
              },
              ...s.unitEvents,
            ].slice(0, 100),
          }));
          void (async () => {
            try {
              const res = await teacherApi.awardClassroomUnits({
                data: {
                  id: eventId,
                  classroomId: student.classroomId,
                  studentId,
                  amount: amt,
                  note: cleanNote,
                },
              });
              if (typeof res.newBalance === "number") {
                set((s) => ({
                  classroomUnitBalances: {
                    ...s.classroomUnitBalances,
                    [studentId]: res.newBalance,
                  },
                }));
              }
            } catch {
              rollback("Could not award classroom Units");
            }
          })();
          return null;
        },

        requestConnection: (joinCode, childName) => {
          const code = joinCode.trim().toUpperCase();
          const trimmed = childName.trim();
          if (!code || !trimmed) return "Enter the classroom join code and your child's name";
          const classroom = get().classrooms.find((c) => c.joinCode === code);
          if (!classroom) return "No classroom uses that join code";
          if (
            get().connections.some(
              (c) =>
                c.classroomId === classroom.id &&
                c.childName.toLowerCase() === trimmed.toLowerCase() &&
                c.status !== "disconnected",
            )
          ) {
            return "A connection for this child already exists";
          }
          const connectionId = crypto.randomUUID();
          syncInBackground(
            () => {
              const connection: TeacherConnection = {
                id: connectionId,
                classroomId: classroom.id,
                classroomName: classroom.name,
                childName: trimmed,
                status: "pending",
                educationalPermissions: true,
                unitPermissions: false,
                requestedAt: nowIso(),
                parentUserId: null,
                parentAccountName: null,
              };
              set((s) => ({ connections: [connection, ...s.connections] }));
            },
            () =>
              teacherApi.requestClassroomConnection({
                data: { id: connectionId, classroomId: classroom.id, childName: trimmed },
              }),
            "Could not send the connection request",
          );
          return null;
        },

        approveConnection: (id) =>
          pushConnectionStatus(id, "approved", "Could not approve the connection"),

        denyConnection: (id) =>
          pushConnectionStatus(id, "disconnected", "Could not deny the connection"),

        disconnectConnection: (id) =>
          pushConnectionStatus(id, "disconnected", "Could not disconnect the connection"),

        setConnectionPermissions: (id, input) => {
          syncInBackground(
            () =>
              set((s) => ({
                connections: s.connections.map((c) =>
                  c.id === id
                    ? {
                        ...c,
                        educationalPermissions: input.educationalPermissions,
                        unitPermissions: input.unitPermissions,
                      }
                    : c,
                ),
              })),
            () =>
              teacherApi.setClassroomConnectionPermissions({
                data: {
                  id,
                  educationalPermissions: input.educationalPermissions,
                  unitPermissions: input.unitPermissions,
                },
              }),
            "Could not update the connection permissions",
          );
        },

        sendMessage: (audience, text) => {
          const trimmed = text.trim();
          if (!trimmed) return "Write a message first";
          const rollback = beginSync();
          const classroomId =
            audience === "All classrooms"
              ? null
              : (get().classrooms.find((c) => c.name === audience)?.id ?? null);
          const id = crypto.randomUUID();
          set((s) => ({
            messages: [
              { id, audience, text: trimmed, at: nowIso() },
              ...s.messages,
            ].slice(0, 50),
          }));
          void (async () => {
            try {
              const res = await teacherApi.postAnnouncement({
                data: { id, classroomId, text: trimmed },
              });
              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === id
                    ? {
                        ...m,
                        audience: res.audienceLabel ?? m.audience,
                        at: res.at ?? m.at,
                      }
                    : m,
                ),
              }));
            } catch {
              rollback("Could not send the message");
            }
          })();
          return null;
        },

        classroomUnitBalance: (studentId) => get().classroomUnitBalances[studentId] ?? 0,

        startThread: (classroomId, parentName, childName, parentUserId) => {
          const parent = parentName.trim();
          const child = childName.trim();
          if (!parent || !child) return "Enter the parent and child names";
          const classroom = get().classrooms.find((c) => c.id === classroomId);
          if (!classroom) return "Choose a classroom first";
          const existing = get().threads.find(
            (t) =>
              t.classroomId === classroomId &&
              t.parentName.toLowerCase() === parent.toLowerCase() &&
              t.childName.toLowerCase() === child.toLowerCase(),
          );
          if (existing) return existing.id;
          const threadId = crypto.randomUUID();
          syncInBackground(
            () => {
              const thread: TeacherThread = {
                id: threadId,
                classroomId,
                classroomName: classroom.name,
                parentName: parent,
                childName: child,
                messages: [],
                updatedAt: nowIso(),
              };
              set((s) => ({ threads: [thread, ...s.threads] }));
            },
            () =>
              teacherApi.startFamilyThread({
                data: {
                  id: threadId,
                  classroomId,
                  parentName: parent,
                  childName: child,
                  parentUserId: parentUserId ?? undefined,
                },
              }),
            "Could not start the conversation",
          );
          return threadId;
        },

        sendThreadMessage: (threadId, from, text) => {
          const trimmed = text.trim();
          if (!trimmed) return "Write a message first";
          if (trimmed.length > 2000) return "Keep messages under 2000 characters";
          const thread = get().threads.find((t) => t.id === threadId);
          if (!thread) return "Conversation not found";
          const rollback = beginSync();
          const msg: TeacherThreadMessage = {
            id: crypto.randomUUID(),
            from,
            text: trimmed,
            at: nowIso(),
          };
          set((s) => ({
            threads: s.threads
              .map((t) =>
                t.id === threadId
                  ? { ...t, messages: [...t.messages, msg].slice(-200), updatedAt: nowIso() }
                  : t,
              )
              .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
          }));
          void (async () => {
            try {
              const res = await teacherApi.sendThreadMessage({
                data: { id: msg.id, threadId, from, body: trimmed },
              });
              if (res.at) {
                set((s) => ({
                  threads: s.threads.map((t) =>
                    t.id === threadId
                      ? {
                          ...t,
                          messages: t.messages.map((m) =>
                            m.id === msg.id ? { ...m, at: res.at } : m,
                          ),
                        }
                      : t,
                  ),
                }));
              }
            } catch {
              rollback("Could not send the message");
            }
          })();
          return null;
        },

        importRoster: (classroomId, names) => {
          const classroom = get().classrooms.find((c) => c.id === classroomId);
          if (!classroom) return { imported: 0, skipped: names.length };
          const seen = new Set(
            get()
              .students.filter((s) => s.classroomId === classroomId)
              .map((s) => s.name.toLowerCase()),
          );
          let imported = 0;
          let skipped = 0;
          const fresh: TeacherStudent[] = [];
          for (const raw of names) {
            const name = raw.trim().replace(/^["']|["']$/g, "").trim();
            if (!name || seen.has(name.toLowerCase())) {
              skipped += 1;
              continue;
            }
            seen.add(name.toLowerCase());
            fresh.push({
              id: crypto.randomUUID(),
              name,
              classroomId,
              joinedAt: nowIso(),
            });
            imported += 1;
          }
          if (fresh.length > 0) {
            const ids = fresh.map((s) => s.id);
            syncInBackground(
              () =>
                set((s) => ({
                  students: [...fresh, ...s.students],
                  classrooms: s.classrooms.map((c) =>
                    c.id === classroomId
                      ? { ...c, studentIds: [...ids, ...c.studentIds] }
                      : c,
                  ),
                })),
              () =>
                teacherApi.importClassroomRoster({
                  data: {
                    classroomId,
                    students: fresh.map((s) => ({ id: s.id, name: s.name })),
                  },
                }),
              "Could not import the roster",
            );
          }
          return { imported, skipped };
        },

        addEarningActivity: (input) => {
          const name = input.name.trim();
          if (!name) return "Give the activity a name";
          const rollback = beginSync();
          const activity: ClassroomActivityTemplate = {
            id: crypto.randomUUID(),
            name,
            amount: Math.max(1, Math.floor(input.amount) || 1),
            hint: input.hint.trim(),
          };
          set((s) => ({ earningActivities: [...s.earningActivities, activity] }));
          void (async () => {
            try {
              await teacherApi.createEarningActivity({
                data: {
                  id: activity.id,
                  name: activity.name,
                  amount: activity.amount,
                  hint: activity.hint,
                },
              });
            } catch {
              rollback("Could not add the earning activity");
            }
          })();
          return null;
        },

        updateEarningActivity: (id, input) => {
          const name = input.name.trim();
          if (!name) return "Give the activity a name";
          const amount = Math.max(1, Math.floor(input.amount) || 1);
          const hint = input.hint.trim();
          syncInBackground(
            () =>
              set((s) => ({
                earningActivities: s.earningActivities.map((a) =>
                  a.id === id ? { ...a, name, amount, hint } : a,
                ),
              })),
            () => teacherApi.updateEarningActivity({ data: { id, name, amount, hint } }),
            "Could not update the earning activity",
          );
          return null;
        },

        removeEarningActivity: (id) => {
          syncInBackground(
            () =>
              set((s) => ({
                earningActivities: s.earningActivities.filter((a) => a.id !== id),
              })),
            () => teacherApi.deleteEarningActivity({ data: { id } }),
            "Could not remove the earning activity",
          );
        },

        resetDemo: () => {
          // Local-only: reseed the client slices so the demo starts fresh.
          // Server data is intentionally untouched — the next loadFromServer()
          // call brings the real workspace back.
          set({
            classrooms: [],
            students: [],
            assignments: [],
            submissions: [],
            connections: [],
            messages: [],
            threads: [],
            classroomUnitBalances: {},
            unitEvents: [],
            lessons: seedLessons(),
            earningActivities: CLASSROOM_ACTIVITY_SEED.map((a) => ({ ...a })),
          });
        },
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
