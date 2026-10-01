import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CLASSROOM_ACTIVITY_SEED,
  type ClassroomActivityTemplate,
} from "@/lib/chores";
import { uid } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* PillarPath Teacher Workspace store                                   */
/*                                                                      */
/* Classroom Units are INTENTIONALLY separate from family Units.        */
/* Teachers only ever see educational data (names, assignments,         */
/* progress, classroom Units) — never family balances, bank info, or    */
/* private marketplace transactions. See Master Manual sections 17, 24. */
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
    id: uid("lesson"),
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
  setTeacherName: (name: string) => void;
  createClassroom: (input: {
    name: string;
    gradeLevel: string;
    subject: string;
  }) => TeacherClassroom;
  addStudent: (classroomId: string, name: string) => string | null;
  joinClassroom: (joinCode: string, studentName: string) => string | null;
  addAnnouncement: (classroomId: string, text: string) => void;
  createLesson: (
    input: Omit<TeacherLesson, "id" | "createdAt" | "seeded">,
  ) => string | null;
  createAssignment: (
    input: Omit<TeacherAssignment, "id" | "createdAt" | "status">,
  ) => string | null;
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

export const useTeacher = create<TeacherState>()(
  persist(
    (set, get) => ({
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

      setTeacherName: (name) => set({ teacherName: name.trim() || "Teacher" }),

      createClassroom: (input) => {
        const classroom: TeacherClassroom = {
          id: uid("class"),
          name: input.name.trim(),
          gradeLevel: input.gradeLevel.trim(),
          subject: input.subject.trim(),
          joinCode: makeJoinCode(),
          studentIds: [],
          announcements: [],
          createdAt: nowIso(),
        };
        set((s) => ({ classrooms: [classroom, ...s.classrooms] }));
        return classroom;
      },

      addStudent: (classroomId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return "Enter a student name";
        const classroom = get().classrooms.find((c) => c.id === classroomId);
        if (!classroom) return "Classroom not found";
        const student: TeacherStudent = {
          id: uid("student"),
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
        return null;
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
        get().addStudent(classroom.id, trimmed);
        return null;
      },

      addAnnouncement: (classroomId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        set((s) => ({
          classrooms: s.classrooms.map((c) =>
            c.id === classroomId
              ? {
                  ...c,
                  announcements: [
                    { id: uid("ann"), text: trimmed, at: nowIso() },
                    ...c.announcements,
                  ],
                }
              : c,
          ),
        }));
      },

      createLesson: (input) => {
        if (!input.title.trim()) return "Give the lesson a title";
        const lesson: TeacherLesson = {
          ...input,
          title: input.title.trim(),
          id: uid("lesson"),
          createdAt: nowIso(),
        };
        set((s) => ({ lessons: [lesson, ...s.lessons] }));
        return null;
      },

      createAssignment: (input) => {
        if (!input.title.trim()) return "Give the assignment a title";
        if (!input.classroomId) return "Choose a classroom";
        const assignment: TeacherAssignment = {
          ...input,
          title: input.title.trim(),
          id: uid("assign"),
          status: "active",
          createdAt: nowIso(),
        };
        set((s) => ({ assignments: [assignment, ...s.assignments] }));
        return null;
      },

      closeAssignment: (id) => {
        set((s) => ({
          assignments: s.assignments.map((a) =>
            a.id === id ? { ...a, status: "closed" as const } : a,
          ),
        }));
      },

      submitAssignment: (assignmentId, studentName, text) => {
        const assignment = get().assignments.find((a) => a.id === assignmentId);
        if (!assignment) return "Assignment not found";
        if (assignment.status !== "active") return "This assignment is closed";
        const trimmed = text.trim();
        if (!trimmed) return "Write your work before submitting";
        let student = get().students.find(
          (s) =>
            s.classroomId === assignment.classroomId &&
            s.name.toLowerCase() === studentName.trim().toLowerCase(),
        );
        if (!student) {
          const err = get().addStudent(assignment.classroomId, studentName);
          if (err) return err;
          student = get().students.find(
            (s) =>
              s.classroomId === assignment.classroomId &&
              s.name.toLowerCase() === studentName.trim().toLowerCase(),
          );
        }
        if (!student) return "Could not enroll the student";
        const submission: TeacherSubmission = {
          id: uid("sub"),
          assignmentId,
          studentId: student.id,
          studentName: student.name,
          text: trimmed,
          submittedAt: nowIso(),
          status: "submitted",
          feedback: "",
          unitsAwarded: 0,
        };
        set((s) => ({ submissions: [submission, ...s.submissions] }));
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
                    id: uid("cue"),
                    studentId: submission.studentId,
                    studentName: submission.studentName,
                    amount: award,
                    note: `Assignment reward · ${assignment?.title ?? "assignment"}`,
                    at: nowIso(),
                  },
                  ...s.unitEvents,
                ].slice(0, 100)
              : s.unitEvents,
        }));
        return null;
      },

      awardClassroomUnits: (studentId, amount, note) => {
        const student = get().students.find((s) => s.id === studentId);
        if (!student) return "Student not found";
        const amt = Math.max(1, Math.floor(amount));
        set((s) => ({
          classroomUnitBalances: {
            ...s.classroomUnitBalances,
            [studentId]: (s.classroomUnitBalances[studentId] ?? 0) + amt,
          },
          unitEvents: [
            {
              id: uid("cue"),
              studentId,
              studentName: student.name,
              amount: amt,
              note: note.trim() || "Classroom reward",
              at: nowIso(),
            },
            ...s.unitEvents,
          ].slice(0, 100),
        }));
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
        const connection: TeacherConnection = {
          id: uid("conn"),
          classroomId: classroom.id,
          classroomName: classroom.name,
          childName: trimmed,
          status: "pending",
          educationalPermissions: true,
          unitPermissions: false,
          requestedAt: nowIso(),
        };
        set((s) => ({ connections: [connection, ...s.connections] }));
        return null;
      },

      approveConnection: (id) => {
        set((s) => ({
          connections: s.connections.map((c) =>
            c.id === id ? { ...c, status: "approved" as const } : c,
          ),
        }));
      },

      denyConnection: (id) => {
        set((s) => ({
          connections: s.connections.map((c) =>
            c.id === id ? { ...c, status: "disconnected" as const } : c,
          ),
        }));
      },

      disconnectConnection: (id) => {
        set((s) => ({
          connections: s.connections.map((c) =>
            c.id === id ? { ...c, status: "disconnected" as const } : c,
          ),
        }));
      },

      setConnectionPermissions: (id, input) => {
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
        }));
      },

      sendMessage: (audience, text) => {
        const trimmed = text.trim();
        if (!trimmed) return "Write a message first";
        set((s) => ({
          messages: [
            { id: uid("msg"), audience, text: trimmed, at: nowIso() },
            ...s.messages,
          ].slice(0, 50),
        }));
        return null;
      },

      classroomUnitBalance: (studentId) => get().classroomUnitBalances[studentId] ?? 0,

      startThread: (classroomId, parentName, childName) => {
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
        const thread: TeacherThread = {
          id: uid("thread"),
          classroomId,
          classroomName: classroom.name,
          parentName: parent,
          childName: child,
          messages: [],
          updatedAt: nowIso(),
        };
        set((s) => ({ threads: [thread, ...s.threads] }));
        return thread.id;
      },

      sendThreadMessage: (threadId, from, text) => {
        const trimmed = text.trim();
        if (!trimmed) return "Write a message first";
        if (trimmed.length > 2000) return "Keep messages under 2000 characters";
        const thread = get().threads.find((t) => t.id === threadId);
        if (!thread) return "Conversation not found";
        const msg: TeacherThreadMessage = {
          id: uid("tmsg"),
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
            id: uid("student"),
            name,
            classroomId,
            joinedAt: nowIso(),
          });
          imported += 1;
        }
        if (fresh.length > 0) {
          const ids = fresh.map((s) => s.id);
          set((s) => ({
            students: [...fresh, ...s.students],
            classrooms: s.classrooms.map((c) =>
              c.id === classroomId
                ? { ...c, studentIds: [...ids, ...c.studentIds] }
                : c,
            ),
          }));
        }
        return { imported, skipped };
      },

      addEarningActivity: (input) => {
        const name = input.name.trim();
        if (!name) return "Give the activity a name";
        const activity: ClassroomActivityTemplate = {
          id: uid("activity"),
          name,
          amount: Math.max(1, Math.floor(input.amount) || 1),
          hint: input.hint.trim(),
        };
        set((s) => ({ earningActivities: [...s.earningActivities, activity] }));
        return null;
      },

      updateEarningActivity: (id, input) => {
        const name = input.name.trim();
        if (!name) return "Give the activity a name";
        set((s) => ({
          earningActivities: s.earningActivities.map((a) =>
            a.id === id
              ? {
                  ...a,
                  name,
                  amount: Math.max(1, Math.floor(input.amount) || 1),
                  hint: input.hint.trim(),
                }
              : a,
          ),
        }));
        return null;
      },

      removeEarningActivity: (id) => {
        set((s) => ({
          earningActivities: s.earningActivities.filter((a) => a.id !== id),
        }));
      },

      resetDemo: () => {
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
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
