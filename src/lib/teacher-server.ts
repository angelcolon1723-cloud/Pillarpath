/**
 * Teacher workspace — server functions.
 *
 * Every function requires the server-verified "teacher" role (roleMiddleware).
 * Functions that touch student details, submissions/grades, classroom Unit
 * awards, or family threads ALSO require teacher_status === "verified"
 * (requireVerifiedTeacher). Ownership is enforced per query: every row is
 * scoped to the caller's teacher_id (students/connections via a join to
 * classrooms), never to a client-supplied id.
 *
 * Classroom Units live ONLY in classroom_unit_events (append-only); balances
 * are derived sums per student. The family ledger is never touched here.
 * Students are roster rows (display names only) — children hold no accounts.
 *
 * Clients generate UUIDs and send them as `id`; they are inserted directly
 * after a format check (no server-side id generation, except for the
 * first-load curriculum/activity seeds and submission review awards).
 */

import { createServerFn } from "@tanstack/react-start";
import { ForbiddenError, roleMiddleware } from "@/lib/auth/middleware";
import type { Identity } from "@/lib/auth/verify.server";
import { getSql, type Sql } from "@/lib/db";
import { CLASSROOM_ACTIVITY_SEED } from "@/lib/chores";

/* ------------------------------------------------------------------ */
/* Exported shapes (for the client integrator).                        */
/* ------------------------------------------------------------------ */

export interface TeacherWorkspaceAnnouncement {
  id: string;
  text: string;
  at: string;
}

export interface TeacherWorkspaceClassroom {
  id: string;
  name: string;
  gradeLevel: string;
  subject: string;
  joinCode: string;
  studentIds: string[];
  announcements: TeacherWorkspaceAnnouncement[];
  createdAt: string;
}

export interface TeacherWorkspaceStudent {
  id: string;
  name: string;
  classroomId: string;
  joinedAt: string;
}

export interface TeacherWorkspaceLesson {
  id: string;
  classroomId: string | null;
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
}

export interface TeacherWorkspaceAssignment {
  id: string;
  classroomId: string;
  title: string;
  description: string;
  instructions: string;
  materials: string;
  rubric: string;
  dueDate: string;
  unitReward: number;
  isCreative: boolean;
  status: string;
  createdAt: string;
}

export interface TeacherWorkspaceSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  body: string;
  status: string;
  feedback: string;
  unitsAwarded: number;
  submittedAt: string;
  reviewedAt: string | null;
}

export interface TeacherWorkspaceConnection {
  id: string;
  classroomId: string;
  classroomName: string;
  childName: string;
  status: string;
  educationalPermissions: boolean;
  unitPermissions: boolean;
  requestedAt: string;
  parentUserId: string | null;
  parentAccountName: string | null;
}

export interface TeacherWorkspaceBroadcast {
  id: string;
  audience: string;
  text: string;
  at: string;
}

export interface TeacherWorkspaceThreadMessage {
  id: string;
  from: string;
  text: string;
  at: string;
}

export interface TeacherWorkspaceThread {
  id: string;
  classroomId: string;
  classroomName: string;
  parentName: string;
  childName: string;
  messages: TeacherWorkspaceThreadMessage[];
  updatedAt: string;
}

export interface TeacherWorkspaceUnitEvent {
  id: string;
  classroomId: string;
  studentId: string;
  studentName: string;
  amount: number;
  note: string;
  at: string;
}

export interface TeacherWorkspaceActivity {
  id: string;
  name: string;
  amount: number;
  hint: string;
}

export interface TeacherWorkspaceData {
  teacherName: string;
  classrooms: TeacherWorkspaceClassroom[];
  students: TeacherWorkspaceStudent[];
  lessons: TeacherWorkspaceLesson[];
  assignments: TeacherWorkspaceAssignment[];
  submissions: TeacherWorkspaceSubmission[];
  connections: TeacherWorkspaceConnection[];
  messages: TeacherWorkspaceBroadcast[];
  threads: TeacherWorkspaceThread[];
  classroomUnitBalances: Record<string, number>;
  unitEvents: TeacherWorkspaceUnitEvent[];
  activities: TeacherWorkspaceActivity[];
}

/* ------------------------------------------------------------------ */
/* First-load curriculum seed (10 financial-literacy modules).          */
/* ------------------------------------------------------------------ */

export interface CurriculumLesson {
  module: string;
  title: string;
  description: string;
  objective: string;
  instructions: string;
  materials: string;
  questions: string;
  completionRequirements: string;
  unitReward: number;
}

export const CURRICULUM: CurriculumLesson[] = [
  {
    module: "Module 1",
    title: "What Is Money?",
    description:
      "Discover what money is and why people use it instead of trading things directly.",
    objective: "Explain what money is and name three ways people use it.",
    instructions:
      "Read the lesson with the class, handle the play money, then answer the questions in your notebook.",
    materials: "Notebook and pencil; play coins and bills for the demo.",
    questions:
      "What is money? Why is money easier than trading toys directly? Name three things money helps people do.",
    completionRequirements:
      "Answer all questions and join the class discussion.",
    unitReward: 5,
  },
  {
    module: "Module 2",
    title: "Earning",
    description:
      "Learn the difference between earning money through work and receiving money as a gift.",
    objective:
      "Describe two ways to earn money and explain what it means to earn something.",
    instructions:
      "Brainstorm jobs you see in your community, pick one, and explain what that worker does to earn their pay.",
    materials: "Notebook and pencil.",
    questions:
      "What does it mean to earn money? Name two jobs in your neighborhood. What is the difference between a gift and a wage?",
    completionRequirements:
      "Share your job pick with the class and answer the questions.",
    unitReward: 5,
  },
  {
    module: "Module 3",
    title: "Saving",
    description:
      "Find out why saving matters and how small amounts grow over time.",
    objective: "Explain why people save and set a simple savings goal.",
    instructions:
      "Set a savings goal for something you want, then plan how many weeks of saving it will take to get there.",
    materials: "Notebook and pencil; savings goal worksheet.",
    questions:
      "Why do people save money? What is a savings goal? How does saving a little each week add up?",
    completionRequirements:
      "Write down your savings goal and your weekly plan.",
    unitReward: 10,
  },
  {
    module: "Module 4",
    title: "Spending",
    description:
      "Learn to tell needs from wants before you spend a single Unit.",
    objective:
      "Sort items into needs and wants and explain the difference.",
    instructions:
      "List ten things you would like to buy, then label each one a need or a want and be ready to defend one choice.",
    materials: "Notebook and pencil; old magazines or store flyers (optional).",
    questions:
      "What is the difference between a need and a want? Is a new toy a need or a want — why? Name one need your family spends money on.",
    completionRequirements:
      "Complete your needs-and-wants list and defend one choice out loud.",
    unitReward: 5,
  },
  {
    module: "Module 5",
    title: "Budgeting",
    description:
      "Make a simple budget: decide where your Units go before you spend them.",
    objective:
      "Create a simple budget that splits money into save, spend, and share.",
    instructions:
      "Take 100 Units of pretend income and split it into Save, Spend, and Share jars, then explain your split.",
    materials: "Notebook and pencil; three labeled jars or envelopes.",
    questions:
      "What is a budget? What are the three jars? Why is it smart to plan spending before it happens?",
    completionRequirements:
      "Show your 100-Unit budget and explain each jar's share.",
    unitReward: 10,
  },
  {
    module: "Module 6",
    title: "Goals",
    description:
      "Turn wishes into plans with short-term and long-term goals.",
    objective:
      "Write one short-term and one long-term goal, each with steps to reach it.",
    instructions:
      "Pick something you want this month and something you want this year, then list the steps that get you to each.",
    materials: "Notebook and pencil.",
    questions:
      "What is a short-term goal? What is a long-term goal? What steps move you closer to a goal?",
    completionRequirements:
      "Write both goals with at least two steps each.",
    unitReward: 10,
  },
  {
    module: "Module 7",
    title: "Banking Concepts",
    description:
      "Learn what banks do and how accounts keep money safe.",
    objective:
      "Explain what a bank does and the difference between saving and checking.",
    instructions:
      "Read about banks, then role-play depositing Units at the classroom bank.",
    materials: "Notebook and pencil; play money for the role-play.",
    questions:
      "What does a bank do with your money? What is a savings account? Why is a bank safer than a piggy bank for large amounts?",
    completionRequirements:
      "Complete the classroom bank role-play and answer the questions.",
    unitReward: 5,
  },
  {
    module: "Module 8",
    title: "Investing Concepts",
    description:
      "Discover how investing puts money to work — and why it takes patience.",
    objective:
      "Explain investing in simple terms and why time matters.",
    instructions:
      "Track a pretend investment for two weeks on the tracker sheet and note how it changes.",
    materials: "Notebook and pencil; pretend investment tracker.",
    questions:
      "What does it mean to invest? Why can investments go up and down? Why is patience important when investing?",
    completionRequirements:
      "Fill in your two-week tracker and share one observation.",
    unitReward: 10,
  },
  {
    module: "Module 9",
    title: "Entrepreneurship",
    description:
      "Dream up a kid business: what will you sell, and to whom?",
    objective:
      "Design a simple business idea with a product, a price, and customers.",
    instructions:
      "Invent a business, name it, pick a product, set a price, and pitch it to the class in one minute.",
    materials: "Notebook and pencil; poster paper for your pitch (optional).",
    questions:
      "What is an entrepreneur? What makes a good business idea? How do you decide what price to charge?",
    completionRequirements:
      "Deliver your one-minute pitch and answer one class question.",
    unitReward: 15,
  },
  {
    module: "Module 10",
    title: "Long-Term Planning",
    description:
      "Put it all together: earn, save, spend wisely, and plan for the future.",
    objective:
      "Explain how earning, saving, spending, and planning work together over time.",
    instructions:
      "Write a one-page 'My Money Plan' using everything you learned this term.",
    materials: "Notebook and pencil.",
    questions:
      "How do earning, saving, and spending connect? What is one long-term plan you have? What money habit will you start this week?",
    completionRequirements:
      "Hand in your 'My Money Plan' and share one habit with the class.",
    unitReward: 10,
  },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function assertUuid(value: unknown, label = "id"): string {
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function requireNonBlank(v: unknown, label: string): string {
  const s = clean(v);
  if (!s) throw new Error(`${label} is required.`);
  return s;
}

/** timestamptz arrives as a Date (pg) — normalize to an ISO string. */
function toISO(v: string | Date): string {
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/**
 * Guards functions that expose student details, grades, Unit awards, or
 * family threads. Non-teachers get a 403; teachers still awaiting
 * verification get a catchable VERIFICATION_REQUIRED error.
 */
export function requireVerifiedTeacher(
  identity: Identity,
): asserts identity is Extract<Identity, { kind: "teacher" }> {
  if (identity.kind !== "teacher") {
    throw new ForbiddenError(identity.kind);
  }
  if (identity.teacherStatus !== "verified") {
    throw new Error(
      "VERIFICATION_REQUIRED: Verify your educator status to access student details.",
    );
  }
}

/** Ownership check: the classroom must belong to the caller. */
async function assertOwnClassroom(
  sql: Sql,
  teacherId: string,
  classroomId: string,
): Promise<{ id: string; name: string }> {
  const rows = await sql<{ id: string; name: string }>`
    select id, name from classrooms
    where id = ${classroomId} and teacher_id = ${teacherId}`;
  const row = rows[0];
  if (!row) throw new Error("Classroom not found.");
  return row;
}

/** Ownership check: the student must sit in one of the caller's classrooms. */
async function assertOwnStudent(
  sql: Sql,
  teacherId: string,
  studentId: string,
): Promise<{ id: string; classroomId: string }> {
  const rows = await sql<{ id: string; classroom_id: string }>`
    select s.id, s.classroom_id
    from classroom_students s
    join classrooms c on c.id = s.classroom_id
    where s.id = ${studentId} and c.teacher_id = ${teacherId}`;
  const row = rows[0];
  if (!row) throw new Error("Student not found.");
  return { id: row.id, classroomId: row.classroom_id };
}

/**
 * Build a parameterized SET clause from whitelisted [column, value] pairs.
 * Column names are hardcoded at each call site — never client input.
 */
function buildSet(pairs: [string, unknown][]): {
  clause: string;
  values: unknown[];
} {
  return {
    clause: pairs.map(([col], i) => `${col} = $${i + 2}`).join(", "),
    values: pairs.map(([, v]) => v),
  };
}

const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeJoinCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = "";
  for (const b of bytes) code += JOIN_CODE_ALPHABET[b % JOIN_CODE_ALPHABET.length];
  return code;
}

async function seedCurriculumIfEmpty(sql: Sql, teacherId: string): Promise<void> {
  const count = await sql<{ n: string }>`
    select count(*)::text as n from lessons where teacher_id = ${teacherId}`;
  if (Number(count[0]?.n ?? "0") > 0) return;
  for (const lesson of CURRICULUM) {
    await sql`
      insert into lessons (id, teacher_id, classroom_id, title, module, description,
        objective, instructions, materials, questions, completion_requirements,
        unit_reward, due_date)
      values (${crypto.randomUUID()}, ${teacherId}, ${null}, ${lesson.title},
        ${lesson.module}, ${lesson.description}, ${lesson.objective},
        ${lesson.instructions}, ${lesson.materials}, ${lesson.questions},
        ${lesson.completionRequirements}, ${lesson.unitReward}, ${""})`;
  }
}

async function seedActivitiesIfEmpty(sql: Sql, teacherId: string): Promise<void> {
  const count = await sql<{ n: string }>`
    select count(*)::text as n from classroom_activities where teacher_id = ${teacherId}`;
  if (Number(count[0]?.n ?? "0") > 0) return;
  // The template ids in CLASSROOM_ACTIVITY_SEED are not UUIDs, so the rows get
  // fresh UUIDs; name/amount/hint carry over verbatim.
  for (const a of CLASSROOM_ACTIVITY_SEED) {
    await sql`
      insert into classroom_activities (id, teacher_id, name, amount, hint)
      values (${crypto.randomUUID()}, ${teacherId}, ${a.name}, ${a.amount}, ${a.hint})`;
  }
}

/* ------------------------------------------------------------------ */
/* Workspace load (GET)                                                */
/* ------------------------------------------------------------------ */

export const loadTeacherWorkspace = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("teacher")])
  .handler(async ({ context }): Promise<TeacherWorkspaceData> => {
    const teacherId = context.identity.userId;
    const sql = await getSql();

    // Unverified teachers get the workspace shell (classrooms, lessons,
    // assignments, announcements) but NO student details until an admin
    // verifies their educator status. Mutations on student data are gated
    // separately by requireVerifiedTeacher.
    const verified =
      context.identity.kind === "teacher" &&
      context.identity.teacherStatus === "verified";

    await seedCurriculumIfEmpty(sql, teacherId);
    await seedActivitiesIfEmpty(sql, teacherId);

    const userRows = await sql<{ name: string | null }>`
      select name from "user" where id = ${teacherId}`;
    const teacherName = clean(userRows[0]?.name) || "Teacher";

    const classroomRows = await sql<{
      id: string;
      name: string;
      grade: string;
      subject: string;
      join_code: string;
      created_at: string | Date;
    }>`
      select id, name, grade, subject, join_code, created_at
      from classrooms where teacher_id = ${teacherId}
      order by created_at desc`;

    const studentRows = verified ? await sql<{
      id: string;
      classroom_id: string;
      display_name: string;
      created_at: string | Date;
    }>`
      select s.id, s.classroom_id, s.display_name, s.created_at
      from classroom_students s
      join classrooms c on c.id = s.classroom_id
      where c.teacher_id = ${teacherId}
      order by s.created_at desc` : [];

    const roomAnnouncementRows = await sql<{
      id: string;
      classroom_id: string;
      body: string;
      created_at: string | Date;
    }>`
      select id, classroom_id, body, created_at
      from classroom_announcements
      where teacher_id = ${teacherId} and classroom_id is not null
      order by created_at desc`;

    const broadcastRows = await sql<{
      id: string;
      audience_label: string;
      body: string;
      created_at: string | Date;
    }>`
      select id, audience_label, body, created_at
      from classroom_announcements
      where teacher_id = ${teacherId} and classroom_id is null
      order by created_at desc`;

    const lessonRows = await sql<{
      id: string;
      classroom_id: string | null;
      module: string;
      title: string;
      description: string;
      objective: string;
      instructions: string;
      materials: string;
      questions: string;
      completion_requirements: string;
      unit_reward: number;
      due_date: string;
      created_at: string | Date;
    }>`
      select id, classroom_id, module, title, description, objective, instructions,
        materials, questions, completion_requirements, unit_reward, due_date, created_at
      from lessons where teacher_id = ${teacherId}
      order by created_at desc`;

    const assignmentRows = await sql<{
      id: string;
      classroom_id: string;
      title: string;
      description: string;
      instructions: string;
      materials: string;
      rubric: string;
      due_date: string;
      unit_reward: number;
      is_creative: boolean;
      status: string;
      created_at: string | Date;
    }>`
      select id, classroom_id, title, description, instructions, materials, rubric,
        due_date, unit_reward, is_creative, status, created_at
      from assignments where teacher_id = ${teacherId}
      order by created_at desc`;

    const submissionRows = verified ? await sql<{
      id: string;
      assignment_id: string;
      student_id: string;
      student_name: string;
      body: string;
      status: string;
      feedback: string;
      units_awarded: number;
      submitted_at: string | Date;
      reviewed_at: string | Date | null;
    }>`
      select s.id, s.assignment_id, s.student_id, st.display_name as student_name,
        s.body, s.status, s.feedback, s.units_awarded, s.submitted_at, s.reviewed_at
      from assignment_submissions s
      join assignments a on a.id = s.assignment_id
      join classroom_students st on st.id = s.student_id
      where a.teacher_id = ${teacherId}
      order by s.submitted_at desc` : [];

    const connectionRows = verified ? await sql<{
      id: string;
      classroom_id: string;
      classroom_name: string;
      child_name: string;
      status: string;
      educational_permissions: boolean;
      unit_permissions: boolean;
      requested_at: string | Date;
      parent_user_id: string | null;
      parent_account_name: string | null;
    }>`
      select cc.id, cc.classroom_id, c.name as classroom_name, cc.child_name, cc.status,
        cc.educational_permissions, cc.unit_permissions, cc.requested_at,
        cc.parent_user_id, pu.name as parent_account_name
      from classroom_connections cc
      join classrooms c on c.id = cc.classroom_id
      left join "user" pu on pu.id = cc.parent_user_id
      where c.teacher_id = ${teacherId}
      order by cc.requested_at desc` : [];

    const threadRows = verified ? await sql<{
      id: string;
      classroom_id: string;
      classroom_name: string;
      parent_name: string;
      child_name: string;
      updated_at: string | Date;
    }>`
      select ft.id, ft.classroom_id, c.name as classroom_name, ft.parent_name,
        ft.child_name, ft.updated_at
      from family_threads ft
      join classrooms c on c.id = ft.classroom_id
      where ft.teacher_id = ${teacherId}
      order by ft.updated_at desc` : [];

    const threadMessageRows = verified ? await sql<{
      id: string;
      thread_id: string;
      sender: string;
      body: string;
      created_at: string | Date;
    }>`
      select tm.id, tm.thread_id, tm.sender, tm.body, tm.created_at
      from thread_messages tm
      join family_threads ft on ft.id = tm.thread_id
      where ft.teacher_id = ${teacherId}
      order by tm.created_at asc` : [];

    const eventRows = verified ? await sql<{
      id: string;
      classroom_id: string;
      student_id: string;
      student_name: string;
      amount: number;
      note: string;
      created_at: string | Date;
    }>`
      select e.id, e.classroom_id, e.student_id, st.display_name as student_name,
        e.amount, e.note, e.created_at
      from classroom_unit_events e
      join classroom_students st on st.id = e.student_id
      where e.teacher_id = ${teacherId}
      order by e.created_at desc` : [];

    const balanceRows = verified ? await sql<{ student_id: string; total: string }>`
      select student_id, sum(amount)::text as total
      from classroom_unit_events
      where teacher_id = ${teacherId}
      group by student_id` : [];

    const activityRows = await sql<{
      id: string;
      name: string;
      amount: number;
      hint: string;
    }>`
      select id, name, amount, hint
      from classroom_activities where teacher_id = ${teacherId}
      order by created_at desc`;

    const announcementsByClassroom = new Map<string, TeacherWorkspaceAnnouncement[]>();
    for (const a of roomAnnouncementRows) {
      const list = announcementsByClassroom.get(a.classroom_id) ?? [];
      list.push({ id: a.id, text: a.body, at: toISO(a.created_at) });
      announcementsByClassroom.set(a.classroom_id, list);
    }

    const studentIdsByClassroom = new Map<string, string[]>();
    for (const s of studentRows) {
      const list = studentIdsByClassroom.get(s.classroom_id) ?? [];
      list.push(s.id);
      studentIdsByClassroom.set(s.classroom_id, list);
    }

    const messagesByThread = new Map<string, TeacherWorkspaceThreadMessage[]>();
    for (const m of threadMessageRows) {
      const list = messagesByThread.get(m.thread_id) ?? [];
      list.push({ id: m.id, from: m.sender, text: m.body, at: toISO(m.created_at) });
      messagesByThread.set(m.thread_id, list);
    }

    const classroomUnitBalances: Record<string, number> = {};
    for (const b of balanceRows) {
      classroomUnitBalances[b.student_id] = Number(b.total ?? 0);
    }

    return {
      teacherName,
      classrooms: classroomRows.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.grade ?? "",
        subject: c.subject ?? "",
        joinCode: c.join_code,
        studentIds: studentIdsByClassroom.get(c.id) ?? [],
        announcements: announcementsByClassroom.get(c.id) ?? [],
        createdAt: toISO(c.created_at),
      })),
      students: studentRows.map((s) => ({
        id: s.id,
        name: s.display_name,
        classroomId: s.classroom_id,
        joinedAt: toISO(s.created_at),
      })),
      lessons: lessonRows.map((l) => ({
        id: l.id,
        classroomId: l.classroom_id,
        module: l.module ?? "",
        title: l.title,
        description: l.description ?? "",
        objective: l.objective ?? "",
        instructions: l.instructions ?? "",
        materials: l.materials ?? "",
        questions: l.questions ?? "",
        completionRequirements: l.completion_requirements ?? "",
        unitReward: Number(l.unit_reward ?? 0),
        dueDate: l.due_date ?? "",
        createdAt: toISO(l.created_at),
      })),
      assignments: assignmentRows.map((a) => ({
        id: a.id,
        classroomId: a.classroom_id,
        title: a.title,
        description: a.description ?? "",
        instructions: a.instructions ?? "",
        materials: a.materials ?? "",
        rubric: a.rubric ?? "",
        dueDate: a.due_date ?? "",
        unitReward: Number(a.unit_reward ?? 0),
        isCreative: a.is_creative === true,
        status: a.status,
        createdAt: toISO(a.created_at),
      })),
      submissions: submissionRows.map((s) => ({
        id: s.id,
        assignmentId: s.assignment_id,
        studentId: s.student_id,
        studentName: s.student_name,
        body: s.body ?? "",
        status: s.status,
        feedback: s.feedback ?? "",
        unitsAwarded: Number(s.units_awarded ?? 0),
        submittedAt: toISO(s.submitted_at),
        reviewedAt: s.reviewed_at == null ? null : toISO(s.reviewed_at),
      })),
      connections: connectionRows.map((c) => ({
        id: c.id,
        classroomId: c.classroom_id,
        classroomName: c.classroom_name,
        childName: c.child_name,
        status: c.status,
        educationalPermissions: c.educational_permissions === true,
        unitPermissions: c.unit_permissions === true,
        requestedAt: toISO(c.requested_at),
        parentUserId: c.parent_user_id,
        parentAccountName: c.parent_account_name,
      })),
      messages: broadcastRows.map((b) => ({
        id: b.id,
        audience: b.audience_label,
        text: b.body,
        at: toISO(b.created_at),
      })),
      threads: threadRows.map((t) => ({
        id: t.id,
        classroomId: t.classroom_id,
        classroomName: t.classroom_name,
        parentName: t.parent_name,
        childName: t.child_name,
        messages: messagesByThread.get(t.id) ?? [],
        updatedAt: toISO(t.updated_at),
      })),
      classroomUnitBalances,
      unitEvents: eventRows.map((e) => ({
        id: e.id,
        classroomId: e.classroom_id,
        studentId: e.student_id,
        studentName: e.student_name,
        amount: Number(e.amount ?? 0),
        note: e.note ?? "",
        at: toISO(e.created_at),
      })),
      activities: activityRows.map((a) => ({
        id: a.id,
        name: a.name,
        amount: Number(a.amount ?? 0),
        hint: a.hint ?? "",
      })),
    };
  });

/* ------------------------------------------------------------------ */
/* Classrooms                                                          */
/* ------------------------------------------------------------------ */

export const createClassroom = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: { id: string; name: string; gradeLevel?: string; subject?: string }) =>
      input,
  )
  .handler(async ({ context, data }): Promise<{ id: string; joinCode: string }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const name = requireNonBlank(data.name, "Classroom name");
    const gradeLevel = clean(data.gradeLevel);
    const subject = clean(data.subject);
    const sql = await getSql();

    // Retry on unique collision (max 5 tries); the DB unique constraint on
    // join_code is the final arbiter, so a race just retries.
    let joinCode = "";
    let inserted = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      joinCode = makeJoinCode();
      try {
        await sql`
          insert into classrooms (id, teacher_id, name, grade, subject, join_code)
          values (${id}, ${teacherId}, ${name}, ${gradeLevel}, ${subject}, ${joinCode})`;
        inserted = true;
        break;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "23505" && attempt < 4) continue;
        throw err;
      }
    }
    if (!inserted) throw new Error("Could not generate a unique join code. Please try again.");
    return { id, joinCode };
  });

export const regenClassroomJoinCode = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { classroomId: string }) => input)
  .handler(async ({ context, data }): Promise<{ joinCode: string }> => {
    const teacherId = context.identity.userId;
    const classroomId = assertUuid(data.classroomId, "classroomId");
    const sql = await getSql();
    await assertOwnClassroom(sql, teacherId, classroomId);

    let joinCode = "";
    let updated = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      joinCode = makeJoinCode();
      try {
        await sql`
          update classrooms set join_code = ${joinCode}
          where id = ${classroomId} and teacher_id = ${teacherId}`;
        updated = true;
        break;
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "23505" && attempt < 4) continue;
        throw err;
      }
    }
    if (!updated) throw new Error("Could not generate a unique join code. Please try again.");
    return { joinCode };
  });

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

export const postAnnouncement = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string; classroomId: string | null; text: string }) => input)
  .handler(
    async ({ context, data }): Promise<{ id: string; at: string; audienceLabel: string }> => {
      const teacherId = context.identity.userId;
      const id = assertUuid(data.id);
      const text = requireNonBlank(data.text, "Announcement text");
      const sql = await getSql();

      let classroomId: string | null = null;
      let audienceLabel = "All classrooms";
      if (data.classroomId != null) {
        classroomId = assertUuid(data.classroomId, "classroomId");
        const room = await assertOwnClassroom(sql, teacherId, classroomId);
        audienceLabel = room.name;
      }

      const rows = await sql<{ created_at: string | Date }>`
        insert into classroom_announcements (id, teacher_id, classroom_id, audience_label, body)
        values (${id}, ${teacherId}, ${classroomId}, ${audienceLabel}, ${text})
        returning created_at`;
      return { id, at: toISO(rows[0].created_at), audienceLabel };
    },
  );

/* ------------------------------------------------------------------ */
/* Roster (verified teachers only)                                     */
/* ------------------------------------------------------------------ */

export const addClassroomStudent = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string; classroomId: string; name: string }) => input)
  .handler(async ({ context, data }): Promise<{ id: string; joinedAt: string }> => {
    requireVerifiedTeacher(context.identity);
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const classroomId = assertUuid(data.classroomId, "classroomId");
    const name = requireNonBlank(data.name, "Student name");
    const sql = await getSql();
    await assertOwnClassroom(sql, teacherId, classroomId);

    const dupes = await sql<{ n: string }>`
      select count(*)::text as n from classroom_students
      where classroom_id = ${classroomId} and lower(display_name) = lower(${name})`;
    if (Number(dupes[0]?.n ?? "0") > 0) {
      throw new Error("That name is already on this classroom roster.");
    }

    const rows = await sql<{ created_at: string | Date }>`
      insert into classroom_students (id, classroom_id, display_name)
      values (${id}, ${classroomId}, ${name})
      returning created_at`;
    return { id, joinedAt: toISO(rows[0].created_at) };
  });

export const removeClassroomStudent = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { studentId: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    requireVerifiedTeacher(context.identity);
    const teacherId = context.identity.userId;
    const studentId = assertUuid(data.studentId, "studentId");
    const sql = await getSql();
    const student = await assertOwnStudent(sql, teacherId, studentId);
    // Cascades (on delete cascade) wipe this student's submissions and
    // classroom Unit events — roster removal is intentionally final.
    await sql`delete from classroom_students where id = ${student.id}`;
    return { ok: true };
  });

export const importClassroomRoster = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { classroomId: string; students: { id: string; name: string }[] }) => input)
  .handler(
    async ({ context, data }): Promise<{ imported: number; skipped: number }> => {
      requireVerifiedTeacher(context.identity);
      const teacherId = context.identity.userId;
      const classroomId = assertUuid(data.classroomId, "classroomId");
      if (!Array.isArray(data.students)) {
        throw new Error("students must be an array.");
      }
      const sql = await getSql();
      await assertOwnClassroom(sql, teacherId, classroomId);

      const existing = await sql<{ display_name: string }>`
        select display_name from classroom_students where classroom_id = ${classroomId}`;
      const seen = new Set(existing.map((r) => r.display_name.toLowerCase()));

      let imported = 0;
      let skipped = 0;
      for (const entry of data.students) {
        const name = clean(entry?.name);
        const id = entry?.id;
        if (!name || typeof id !== "string" || !UUID_RE.test(id)) {
          skipped += 1;
          continue;
        }
        const key = name.toLowerCase();
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }
        seen.add(key);
        await sql`
          insert into classroom_students (id, classroom_id, display_name)
          values (${id}, ${classroomId}, ${name})`;
        imported += 1;
      }
      return { imported, skipped };
    },
  );

export const enrollStudentByCode = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string; code: string; studentName: string }) => input)
  .handler(
    async (
      { context, data },
    ): Promise<{ id: string; classroomId: string; classroomName: string }> => {
      requireVerifiedTeacher(context.identity);
      const teacherId = context.identity.userId;
      const id = assertUuid(data.id);
      const code = clean(data.code).toUpperCase();
      if (!code) throw new Error("Join code is required.");
      const studentName = requireNonBlank(data.studentName, "Student name");
      const sql = await getSql();

      // Codes resolve ONLY among the caller's own classrooms.
      const rooms = await sql<{ id: string; name: string }>`
        select id, name from classrooms
        where teacher_id = ${teacherId} and join_code = ${code}`;
      const room = rooms[0];
      if (!room) {
        throw new Error("That code didn't match any of your classrooms.");
      }

      const dupes = await sql<{ n: string }>`
        select count(*)::text as n from classroom_students
        where classroom_id = ${room.id} and lower(display_name) = lower(${studentName})`;
      if (Number(dupes[0]?.n ?? "0") > 0) {
        throw new Error("That name is already on this classroom roster.");
      }

      await sql`
        insert into classroom_students (id, classroom_id, display_name)
        values (${id}, ${room.id}, ${studentName})`;
      return { id, classroomId: room.id, classroomName: room.name };
    },
  );

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

export interface CreateLessonInput {
  id: string;
  classroomId?: string | null;
  title: string;
  module?: string;
  description?: string;
  objective?: string;
  instructions?: string;
  materials?: string;
  questions?: string;
  completionRequirements?: string;
  unitReward?: number;
  dueDate?: string;
}

export const createLesson = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: CreateLessonInput) => input)
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const title = requireNonBlank(data.title, "Lesson title");
    const sql = await getSql();

    let classroomId: string | null = null;
    if (data.classroomId != null) {
      classroomId = assertUuid(data.classroomId, "classroomId");
      await assertOwnClassroom(sql, teacherId, classroomId);
    }

    await sql`
      insert into lessons (id, teacher_id, classroom_id, title, module, description,
        objective, instructions, materials, questions, completion_requirements,
        unit_reward, due_date)
      values (${id}, ${teacherId}, ${classroomId}, ${title}, ${clean(data.module)},
        ${clean(data.description)}, ${clean(data.objective)}, ${clean(data.instructions)},
        ${clean(data.materials)}, ${clean(data.questions)},
        ${clean(data.completionRequirements)},
        ${Math.max(0, Math.floor(Number(data.unitReward) || 0))}, ${clean(data.dueDate)})`;
    return { id };
  });

export interface UpdateLessonInput {
  id: string;
  classroomId?: string | null;
  title?: string;
  module?: string;
  description?: string;
  objective?: string;
  instructions?: string;
  materials?: string;
  questions?: string;
  completionRequirements?: string;
  unitReward?: number;
  dueDate?: string;
}

export const updateLesson = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: UpdateLessonInput) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const sql = await getSql();

    const owned = await sql<{ id: string }>`
      select id from lessons where id = ${id} and teacher_id = ${teacherId}`;
    if (owned.length === 0) throw new Error("Lesson not found.");

    const pairs: [string, unknown][] = [];
    if (data.classroomId !== undefined) {
      if (data.classroomId === null) {
        pairs.push(["classroom_id", null]);
      } else {
        const cid = assertUuid(data.classroomId, "classroomId");
        await assertOwnClassroom(sql, teacherId, cid);
        pairs.push(["classroom_id", cid]);
      }
    }
    if (data.title !== undefined) pairs.push(["title", requireNonBlank(data.title, "Lesson title")]);
    if (data.module !== undefined) pairs.push(["module", clean(data.module)]);
    if (data.description !== undefined) pairs.push(["description", clean(data.description)]);
    if (data.objective !== undefined) pairs.push(["objective", clean(data.objective)]);
    if (data.instructions !== undefined) pairs.push(["instructions", clean(data.instructions)]);
    if (data.materials !== undefined) pairs.push(["materials", clean(data.materials)]);
    if (data.questions !== undefined) pairs.push(["questions", clean(data.questions)]);
    if (data.completionRequirements !== undefined)
      pairs.push(["completion_requirements", clean(data.completionRequirements)]);
    if (data.unitReward !== undefined)
      pairs.push(["unit_reward", Math.max(0, Math.floor(Number(data.unitReward) || 0))]);
    if (data.dueDate !== undefined) pairs.push(["due_date", clean(data.dueDate)]);

    if (pairs.length > 0) {
      const { clause, values } = buildSet(pairs);
      await sql.query(
        `update lessons set ${clause} where id = $1 and teacher_id = $${values.length + 2}`,
        [id, ...values, teacherId],
      );
    }
    return { ok: true };
  });

export const deleteLesson = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from lessons where id = ${id} and teacher_id = ${teacherId}`;
    if (owned.length === 0) throw new Error("Lesson not found.");
    await sql`delete from lessons where id = ${id} and teacher_id = ${teacherId}`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

export interface CreateAssignmentInput {
  id: string;
  classroomId: string;
  title: string;
  description?: string;
  instructions?: string;
  materials?: string;
  rubric?: string;
  dueDate?: string;
  unitReward?: number;
  isCreative?: boolean;
}

export const createAssignment = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: CreateAssignmentInput) => input)
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const classroomId = assertUuid(data.classroomId, "classroomId");
    const title = requireNonBlank(data.title, "Assignment title");
    const sql = await getSql();
    await assertOwnClassroom(sql, teacherId, classroomId);

    await sql`
      insert into assignments (id, teacher_id, classroom_id, title, description,
        instructions, materials, rubric, due_date, unit_reward, is_creative, status)
      values (${id}, ${teacherId}, ${classroomId}, ${title}, ${clean(data.description)},
        ${clean(data.instructions)}, ${clean(data.materials)}, ${clean(data.rubric)},
        ${clean(data.dueDate)}, ${Math.max(0, Math.floor(Number(data.unitReward) || 0))},
        ${data.isCreative === true}, ${"active"})`;
    return { id };
  });

export interface UpdateAssignmentInput {
  id: string;
  title?: string;
  description?: string;
  instructions?: string;
  materials?: string;
  rubric?: string;
  dueDate?: string;
  unitReward?: number;
  isCreative?: boolean;
}

export const updateAssignment = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: UpdateAssignmentInput) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const sql = await getSql();

    const owned = await sql<{ id: string }>`
      select id from assignments where id = ${id} and teacher_id = ${teacherId}`;
    if (owned.length === 0) throw new Error("Assignment not found.");

    const pairs: [string, unknown][] = [];
    if (data.title !== undefined)
      pairs.push(["title", requireNonBlank(data.title, "Assignment title")]);
    if (data.description !== undefined) pairs.push(["description", clean(data.description)]);
    if (data.instructions !== undefined) pairs.push(["instructions", clean(data.instructions)]);
    if (data.materials !== undefined) pairs.push(["materials", clean(data.materials)]);
    if (data.rubric !== undefined) pairs.push(["rubric", clean(data.rubric)]);
    if (data.dueDate !== undefined) pairs.push(["due_date", clean(data.dueDate)]);
    if (data.unitReward !== undefined)
      pairs.push(["unit_reward", Math.max(0, Math.floor(Number(data.unitReward) || 0))]);
    if (data.isCreative !== undefined) pairs.push(["is_creative", data.isCreative === true]);

    if (pairs.length > 0) {
      const { clause, values } = buildSet(pairs);
      await sql.query(
        `update assignments set ${clause} where id = $1 and teacher_id = $${values.length + 2}`,
        [id, ...values, teacherId],
      );
    }
    return { ok: true };
  });

export const closeAssignment = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from assignments where id = ${id} and teacher_id = ${teacherId}`;
    if (owned.length === 0) throw new Error("Assignment not found.");
    await sql`
      update assignments set status = 'closed'
      where id = ${id} and teacher_id = ${teacherId}`;
    return { ok: true };
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from assignments where id = ${id} and teacher_id = ${teacherId}`;
    if (owned.length === 0) throw new Error("Assignment not found.");
    // Submissions cascade off the assignment FK.
    await sql`delete from assignments where id = ${id} and teacher_id = ${teacherId}`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Submissions / gradebook (verified teachers only)                    */
/* ------------------------------------------------------------------ */

export const logAssignmentSubmission = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: { id: string; assignmentId: string; studentId: string; body?: string }) =>
      input,
  )
  .handler(async ({ context, data }): Promise<{ id: string; submittedAt: string }> => {
    requireVerifiedTeacher(context.identity);
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const assignmentId = assertUuid(data.assignmentId, "assignmentId");
    const studentId = assertUuid(data.studentId, "studentId");
    const body = clean(data.body);
    const sql = await getSql();

    const aRows = await sql<{ id: string; classroom_id: string; status: string }>`
      select id, classroom_id, status from assignments
      where id = ${assignmentId} and teacher_id = ${teacherId}`;
    const assignment = aRows[0];
    if (!assignment) throw new Error("Assignment not found.");
    if (assignment.status !== "active") {
      throw new Error("This assignment is closed and no longer accepts submissions.");
    }

    const student = await assertOwnStudent(sql, teacherId, studentId);
    if (student.classroomId !== assignment.classroom_id) {
      throw new Error("That student is not in this assignment's classroom.");
    }

    const rows = await sql<{ submitted_at: string | Date }>`
      insert into assignment_submissions (id, assignment_id, student_id, body, status)
      values (${id}, ${assignmentId}, ${studentId}, ${body}, ${"submitted"})
      returning submitted_at`;
    return { id, submittedAt: toISO(rows[0].submitted_at) };
  });

const SUBMISSION_STATUSES = ["submitted", "reviewed", "complete"] as const;

export const reviewAssignmentSubmission = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: {
      id: string;
      feedback?: string;
      status: "submitted" | "reviewed" | "complete";
      awardUnits?: number;
    }) => input,
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    requireVerifiedTeacher(context.identity);
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    if (!SUBMISSION_STATUSES.includes(data.status)) {
      throw new Error("Invalid submission status.");
    }
    const feedback = clean(data.feedback);
    const sql = await getSql();

    const rows = await sql<{
      id: string;
      student_id: string;
      classroom_id: string;
      assignment_title: string;
    }>`
      select s.id, s.student_id, a.classroom_id, a.title as assignment_title
      from assignment_submissions s
      join assignments a on a.id = s.assignment_id
      where s.id = ${id} and a.teacher_id = ${teacherId}`;
    const submission = rows[0];
    if (!submission) throw new Error("Submission not found.");

    // Classroom Unit award: only when marking complete, and only for a
    // positive amount. Mirrors into units_awarded on the submission and an
    // append-only event in classroom_unit_events (never the family ledger).
    const award = Math.max(0, Math.floor(Number(data.awardUnits) || 0));
    const awarding = data.status === "complete" && award > 0;

    const pairs: [string, unknown][] = [
      ["feedback", feedback],
      ["status", data.status],
      ["reviewed_at", new Date()],
    ];
    if (awarding) pairs.push(["units_awarded", award]);
    const { clause, values } = buildSet(pairs);
    await sql.query(
      `update assignment_submissions s set ${clause}
       from assignments a
       where s.id = $1 and s.assignment_id = a.id and a.teacher_id = $${values.length + 2}`,
      [id, ...values, teacherId],
    );

    if (awarding) {
      await sql`
        insert into classroom_unit_events (id, teacher_id, classroom_id, student_id, amount, note)
        values (${crypto.randomUUID()}, ${teacherId}, ${submission.classroom_id},
          ${submission.student_id}, ${award}, ${`Assignment reward · ${submission.assignment_title}`})`;
    }
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Classroom Units (verified teachers only)                            */
/* ------------------------------------------------------------------ */

export const awardClassroomUnits = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: {
      id: string;
      classroomId: string;
      studentId: string;
      amount: number;
      note?: string;
    }) => input,
  )
  .handler(async ({ context, data }): Promise<{ ok: true; newBalance: number }> => {
    requireVerifiedTeacher(context.identity);
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const classroomId = assertUuid(data.classroomId, "classroomId");
    const studentId = assertUuid(data.studentId, "studentId");
    const amount = Math.max(1, Math.floor(Number(data.amount) || 0));
    const note = clean(data.note);
    const sql = await getSql();

    await assertOwnClassroom(sql, teacherId, classroomId);
    const student = await assertOwnStudent(sql, teacherId, studentId);
    if (student.classroomId !== classroomId) {
      throw new Error("That student is not in this classroom.");
    }

    await sql`
      insert into classroom_unit_events (id, teacher_id, classroom_id, student_id, amount, note)
      values (${id}, ${teacherId}, ${classroomId}, ${studentId}, ${amount}, ${note})`;

    const bal = await sql<{ total: string }>`
      select sum(amount)::text as total from classroom_unit_events
      where teacher_id = ${teacherId} and student_id = ${studentId}`;
    return { ok: true, newBalance: Number(bal[0]?.total ?? 0) };
  });

/* ------------------------------------------------------------------ */
/* Family connections                                                  */
/* ------------------------------------------------------------------ */

export const requestClassroomConnection = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string; classroomId: string; childName: string }) => input)
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const classroomId = assertUuid(data.classroomId, "classroomId");
    const childName = requireNonBlank(data.childName, "Child name");
    const sql = await getSql();
    await assertOwnClassroom(sql, teacherId, classroomId);

    const dupes = await sql<{ n: string }>`
      select count(*)::text as n from classroom_connections
      where classroom_id = ${classroomId}
        and lower(child_name) = lower(${childName})
        and status <> 'disconnected'`;
    if (Number(dupes[0]?.n ?? "0") > 0) {
      throw new Error("A connection request for that child already exists.");
    }

    await sql`
      insert into classroom_connections
        (id, classroom_id, child_name, status, educational_permissions, unit_permissions)
      values (${id}, ${classroomId}, ${childName}, ${"pending"}, ${true}, ${false})`;
    return { id };
  });

async function assertOwnConnection(
  sql: Sql,
  teacherId: string,
  connectionId: string,
): Promise<{ id: string }> {
  const rows = await sql<{ id: string }>`
    select cc.id
    from classroom_connections cc
    join classrooms c on c.id = cc.classroom_id
    where cc.id = ${connectionId} and c.teacher_id = ${teacherId}`;
  const row = rows[0];
  if (!row) throw new Error("Connection not found.");
  return row;
}

export const setClassroomConnectionStatus = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string; status: "approved" | "disconnected" }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    if (data.status !== "approved" && data.status !== "disconnected") {
      throw new Error("Invalid connection status.");
    }
    const sql = await getSql();
    await assertOwnConnection(sql, teacherId, id);
    await sql`
      update classroom_connections set status = ${data.status} where id = ${id}`;
    return { ok: true };
  });

export const setClassroomConnectionPermissions = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: { id: string; educationalPermissions: boolean; unitPermissions: boolean }) =>
      input,
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const sql = await getSql();
    await assertOwnConnection(sql, teacherId, id);
    await sql`
      update classroom_connections
      set educational_permissions = ${data.educationalPermissions === true},
          unit_permissions = ${data.unitPermissions === true}
      where id = ${id}`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Family threads (verified teachers only)                             */
/* ------------------------------------------------------------------ */

export const startFamilyThread = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: { id: string; classroomId: string; parentName: string; childName: string; parentUserId?: string }) =>
      input,
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    requireVerifiedTeacher(context.identity);
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const classroomId = assertUuid(data.classroomId, "classroomId");
    const parentName = requireNonBlank(data.parentName, "Parent name");
    const childName = requireNonBlank(data.childName, "Child name");
    const sql = await getSql();
    await assertOwnClassroom(sql, teacherId, classroomId);

    // When the family connected through the app, link the thread to their
    // account so the two-way conversation reaches their inbox. Falls back to
    // matching an approved connection by child name.
    let parentUserId: string | null = null;
    if (data.parentUserId) {
      const link = await sql<{ parent_user_id: string }>`
        select parent_user_id from classroom_connections
        where classroom_id = ${classroomId}
          and parent_user_id = ${data.parentUserId}
          and status = 'approved'
        limit 1`;
      if (link.length > 0) parentUserId = link[0].parent_user_id;
    }
    if (!parentUserId) {
      const match = await sql<{ parent_user_id: string }>`
        select parent_user_id from classroom_connections
        where classroom_id = ${classroomId}
          and lower(child_name) = lower(${childName})
          and status = 'approved'
          and parent_user_id is not null
        order by requested_at desc limit 1`;
      if (match.length > 0) parentUserId = match[0].parent_user_id;
    }

    // Idempotent: the same teacher/classroom/parent/child always maps to one
    // thread (case-insensitive on names).
    const existing = await sql<{ id: string }>`
      select id from family_threads
      where teacher_id = ${teacherId}
        and classroom_id = ${classroomId}
        and lower(parent_name) = lower(${parentName})
        and lower(child_name) = lower(${childName})
      order by created_at asc limit 1`;
    if (existing.length > 0) {
      if (parentUserId) {
        await sql`update family_threads set parent_user_id = ${parentUserId} where id = ${existing[0].id} and parent_user_id is null`;
      }
      return { id: existing[0].id };
    }

    await sql`
      insert into family_threads (id, teacher_id, classroom_id, parent_name, child_name, parent_user_id)
      values (${id}, ${teacherId}, ${classroomId}, ${parentName}, ${childName}, ${parentUserId})`;
    return { id };
  });

export const sendThreadMessage = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: { id: string; threadId: string; from: "teacher" | "parent"; body: string }) =>
      input,
  )
  .handler(async ({ context, data }): Promise<{ id: string; at: string }> => {
    requireVerifiedTeacher(context.identity);
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const threadId = assertUuid(data.threadId, "threadId");
    if (data.from !== "teacher" && data.from !== "parent") {
      throw new Error("Invalid message sender.");
    }
    const body = requireNonBlank(data.body, "Message");
    if (body.length > 2000) {
      throw new Error("Messages are limited to 2000 characters.");
    }
    const sql = await getSql();

    const owned = await sql<{ id: string }>`
      select id from family_threads where id = ${threadId} and teacher_id = ${teacherId}`;
    if (owned.length === 0) throw new Error("Thread not found.");

    const rows = await sql<{ created_at: string | Date }>`
      insert into thread_messages (id, thread_id, sender, body)
      values (${id}, ${threadId}, ${data.from}, ${body})
      returning created_at`;
    await sql`
      update family_threads set updated_at = now()
      where id = ${threadId} and teacher_id = ${teacherId}`;
    return { id, at: toISO(rows[0].created_at) };
  });

/* ------------------------------------------------------------------ */
/* Earning activities                                                  */
/* ------------------------------------------------------------------ */

export const createEarningActivity = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string; name: string; amount: number; hint?: string }) => input)
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const name = requireNonBlank(data.name, "Activity name");
    const amount = Math.max(1, Math.floor(Number(data.amount) || 0));
    const hint = clean(data.hint);
    const sql = await getSql();
    await sql`
      insert into classroom_activities (id, teacher_id, name, amount, hint)
      values (${id}, ${teacherId}, ${name}, ${amount}, ${hint})`;
    return { id };
  });

export const updateEarningActivity = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: { id: string; name?: string; amount?: number; hint?: string }) => input,
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from classroom_activities where id = ${id} and teacher_id = ${teacherId}`;
    if (owned.length === 0) throw new Error("Activity not found.");

    const pairs: [string, unknown][] = [];
    if (data.name !== undefined)
      pairs.push(["name", requireNonBlank(data.name, "Activity name")]);
    if (data.amount !== undefined)
      pairs.push(["amount", Math.max(1, Math.floor(Number(data.amount) || 0))]);
    if (data.hint !== undefined) pairs.push(["hint", clean(data.hint)]);

    if (pairs.length > 0) {
      const { clause, values } = buildSet(pairs);
      await sql.query(
        `update classroom_activities set ${clause} where id = $1 and teacher_id = $${values.length + 2}`,
        [id, ...values, teacherId],
      );
    }
    return { ok: true };
  });

export const deleteEarningActivity = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const id = assertUuid(data.id);
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from classroom_activities where id = ${id} and teacher_id = ${teacherId}`;
    if (owned.length === 0) throw new Error("Activity not found.");
    await sql`
      delete from classroom_activities where id = ${id} and teacher_id = ${teacherId}`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Teacher profile + verification                                      */
/* ------------------------------------------------------------------ */

export const setTeacherName = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { name: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const teacherId = context.identity.userId;
    const name = clean(data.name) || "Teacher";
    const sql = await getSql();
    await sql`update "user" set name = ${name} where id = ${teacherId}`;
    return { ok: true };
  });

export const requestTeacherVerification = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator(
    (input: { school?: string; district?: string; workEmail?: string; notes?: string }) =>
      input,
  )
  .handler(async ({ context, data }): Promise<{ ok: true; status: string }> => {
    const teacherId = context.identity.userId;
    const school = clean(data.school);
    const district = clean(data.district);
    const workEmail = clean(data.workEmail);
    const notes = clean(data.notes);
    const sql = await getSql();

    // Once verified, always verified — re-requests update the details but
    // never downgrade the status. (teacher_verifications has no updated_at
    // column, so the upsert refreshes the fields and re-derives status while
    // keeping created_at.)
    const existing = await sql<{ status: string }>`
      select status from teacher_verifications where teacher_id = ${teacherId}`;
    const status = existing[0]?.status === "verified" ? "verified" : "pending";

    await sql`
      insert into teacher_verifications (teacher_id, school, district, work_email, notes, status)
      values (${teacherId}, ${school}, ${district}, ${workEmail}, ${notes}, ${status})
      on conflict (teacher_id) do update set
        school = excluded.school,
        district = excluded.district,
        work_email = excluded.work_email,
        notes = excluded.notes,
        status = ${status}`;

    // Mirror to the account row the same way: verified stays verified.
    await sql`
      update "user"
      set teacher_status = ${status}
      where id = ${teacherId}`;
    return { ok: true, status };
  });

/* ------------------------------------------------------------------ */
/* Parent-side messaging (two-way teacher<->parent)                     */
/* ------------------------------------------------------------------ */

export interface ParentClassroomConnection {
  id: string;
  classroomId: string;
  classroomName: string;
  teacherName: string;
  childName: string;
  status: string;
  requestedAt: string;
}

export interface ParentThread {
  id: string;
  parentName: string;
  childName: string;
  classroomName: string;
  teacherName: string;
  updatedAt: string;
  messages: { id: string; sender: string; body: string; at: string }[];
}

/** Parent joins a classroom with the teacher's join code. */
export const joinClassroomByCode = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("parent")])
  .validator((input: { code: string; childName: string }) => input)
  .handler(async ({ context, data }): Promise<{ id: string; classroomName: string; status: string }> => {
    const userId = context.identity.userId;
    const code = data.code.trim().toUpperCase();
    if (!code) throw new Error("Enter the classroom join code.");
    const childName = requireNonBlank(data.childName, "Child name");
    const sql = await getSql();
    const rooms = await sql<{ id: string; name: string }>`
      select id, name from classrooms where join_code = ${code}`;
    if (rooms.length === 0) throw new Error("No classroom found with that code. Check it and try again.");
    const classroomId = rooms[0].id;
    const existing = await sql<{ id: string; status: string }>`
      select id, status from classroom_connections
      where classroom_id = ${classroomId}
        and parent_user_id = ${userId}
        and lower(child_name) = lower(${childName})
        and status <> 'disconnected'
      order by requested_at desc limit 1`;
    if (existing.length > 0) {
      return { id: existing[0].id, classroomName: rooms[0].name, status: existing[0].status };
    }
    const id = crypto.randomUUID();
    await sql`
      insert into classroom_connections (id, classroom_id, child_name, parent_user_id, status)
      values (${id}, ${classroomId}, ${childName}, ${userId}, 'pending')`;
    return { id, classroomName: rooms[0].name, status: "pending" };
  });

/** Parent's classroom connections with teacher/classroom info. */
export const listMyClassroomConnections = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("parent")])
  .handler(async ({ context }): Promise<{ connections: ParentClassroomConnection[] }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; classroom_id: string; classroom_name: string; teacher_name: string;
      child_name: string; status: string; requested_at: string;
    }>`
      select cc.id, cc.classroom_id, c.name as classroom_name,
             coalesce(u.name, 'Teacher') as teacher_name,
             cc.child_name, cc.status, cc.requested_at::text as requested_at
      from classroom_connections cc
      join classrooms c on c.id = cc.classroom_id
      left join "user" u on u.id = c.teacher_id
      where cc.parent_user_id = ${context.identity.userId}
        and cc.status <> 'disconnected'
      order by cc.requested_at desc`;
    return {
      connections: rows.map((r) => ({
        id: r.id,
        classroomId: r.classroom_id,
        classroomName: r.classroom_name,
        teacherName: r.teacher_name,
        childName: r.child_name,
        status: r.status,
        requestedAt: r.requested_at,
      })),
    };
  });

/** Parent's message threads with teachers. */
export const listParentThreads = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("parent")])
  .handler(async ({ context }): Promise<{ threads: ParentThread[] }> => {
    const userId = context.identity.userId;
    const sql = await getSql();
    const threads = await sql<{
      id: string; parent_name: string; child_name: string;
      classroom_name: string; teacher_name: string; updated_at: string;
    }>`
      select ft.id, ft.parent_name, ft.child_name, c.name as classroom_name,
             coalesce(u.name, 'Teacher') as teacher_name,
             ft.updated_at::text as updated_at
      from family_threads ft
      join classrooms c on c.id = ft.classroom_id
      left join "user" u on u.id = ft.teacher_id
      where ft.parent_user_id = ${userId}
      order by ft.updated_at desc`;
    const out: ParentThread[] = [];
    for (const t of threads) {
      const msgs = await sql<{ id: string; sender: string; body: string; at: string }>`
        select id, sender, body, created_at::text as at
        from thread_messages where thread_id = ${t.id} order by created_at asc`;
      out.push({
        id: t.id,
        parentName: t.parent_name,
        childName: t.child_name,
        classroomName: t.classroom_name,
        teacherName: t.teacher_name,
        updatedAt: t.updated_at,
        messages: msgs,
      });
    }
    return { threads: out };
  });

/** Parent replies in their thread. */
export const sendParentThreadMessage = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("parent")])
  .validator((input: { threadId: string; body: string }) => input)
  .handler(async ({ context, data }): Promise<{ id: string; at: string }> => {
    const userId = context.identity.userId;
    const threadId = assertUuid(data.threadId, "threadId");
    const body = requireNonBlank(data.body, "Message");
    if (body.length > 2000) throw new Error("Messages are limited to 2000 characters.");
    const sql = await getSql();
    const owned = await sql<{ id: string }>`
      select id from family_threads where id = ${threadId} and parent_user_id = ${userId}`;
    if (owned.length === 0) throw new Error("Conversation not found.");
    const id = crypto.randomUUID();
    const rows = await sql<{ created_at: string | Date }>`
      insert into thread_messages (id, thread_id, sender, body)
      values (${id}, ${threadId}, 'parent', ${body})
      returning created_at`;
    await sql`update family_threads set updated_at = now() where id = ${threadId}`;
    return { id, at: toISO(rows[0].created_at) };
  });

/* ------------------------------------------------------------------ */
/* Live chalkboard broadcast                                           */
/* ------------------------------------------------------------------ */
/*
 * Teacher draws -> strokes are batched to the server -> students poll
 * for new strokes and watch the board fill in near-real-time.
 * Coordinates are normalized 0-1 so any screen size renders correctly.
 */

export interface ChalkboardStroke {
  seq: number;
  color: string;
  size: number;
  eraser: boolean;
  points: [number, number][];
}

export interface LiveChalkboardSession {
  id: string;
  classroomId: string;
  teacherName: string;
  title: string;
  startedAt: string;
}

/** Teacher starts a live session for a classroom (ends any previous live one). */
export const startChalkboardSession = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { classroomId: string; title?: string }) => input)
  .handler(async ({ context, data }): Promise<{ session: LiveChalkboardSession }> => {
    const sql = await getSql();
    const me = await sql<{ name: string }>`select name from "user" where id = ${context.userId}`;
    const teacherName = me[0]?.name ?? "Teacher";
    await sql`update chalkboard_sessions set is_live = false, ended_at = now()
              where classroom_id = ${data.classroomId} and is_live = true`;
    const rows = await sql<{ id: string; started_at: string }>`
      insert into chalkboard_sessions (classroom_id, teacher_id, teacher_name, title)
      values (${data.classroomId}, ${context.userId}, ${teacherName}, ${data.title ?? "Live lesson"})
      returning id, started_at::text as started_at`;
    return {
      session: {
        id: rows[0].id,
        classroomId: data.classroomId,
        teacherName,
        title: data.title ?? "Live lesson",
        startedAt: rows[0].started_at,
      },
    };
  });

/** Teacher ends the live session. */
export const endChalkboardSession = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { sessionId: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await sql`update chalkboard_sessions set is_live = false, ended_at = now()
              where id = ${data.sessionId} and teacher_id = ${context.userId}`;
    return { ok: true };
  });

/** Teacher pushes a batch of strokes. */
export const pushChalkboardStrokes = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { sessionId: string; strokes: Omit<ChalkboardStroke, "seq">[] }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean; nextSeq: number }> => {
    const sql = await getSql();
    const sess = await sql<{ id: string }>`
      select id from chalkboard_sessions
      where id = ${data.sessionId} and teacher_id = ${context.userId} and is_live = true`;
    if (!sess.length) throw new Error("Session is not live.");
    const maxRow = await sql<{ m: number | null }>`
      select max(seq)::int as m from chalkboard_strokes where session_id = ${data.sessionId}`;
    let seq = (maxRow[0]?.m ?? -1) + 1;
    for (const st of data.strokes.slice(0, 200)) {
      await sql`insert into chalkboard_strokes (session_id, seq, color, size, eraser, points)
        values (${data.sessionId}, ${seq}, ${st.color}, ${st.size}, ${st.eraser},
                ${JSON.stringify(st.points)}::jsonb)
        on conflict (session_id, seq) do nothing`;
      seq++;
    }
    return { ok: true, nextSeq: seq };
  });

/** Anyone in the classroom: is there a live session right now? */
export const getLiveChalkboardSession = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("teacher", "parent")])
  .validator((input: { classroomIds: string[] }) => input)
  .handler(async ({ data }): Promise<{ session: LiveChalkboardSession | null }> => {
    if (!data.classroomIds.length) return { session: null };
    const sql = await getSql();
    const rows = await sql<{ id: string; classroom_id: string; teacher_name: string; title: string; started_at: string }>`
      select id, classroom_id, teacher_name, title, started_at::text as started_at
      from chalkboard_sessions
      where is_live = true and classroom_id = any(${data.classroomIds})
      order by started_at desc limit 1`;
    if (!rows.length) return { session: null };
    const r = rows[0];
    return {
      session: {
        id: r.id, classroomId: r.classroom_id, teacherName: r.teacher_name,
        title: r.title, startedAt: r.started_at,
      },
    };
  });

/** Fetch strokes after a sequence number (polling). */
export const getChalkboardStrokes = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("teacher", "parent")])
  .validator((input: { sessionId: string; afterSeq: number }) => input)
  .handler(async ({ data }): Promise<{ strokes: ChalkboardStroke[]; live: boolean }> => {
    const sql = await getSql();
    const sess = await sql<{ is_live: boolean }>`
      select is_live from chalkboard_sessions where id = ${data.sessionId}`;
    const rows = await sql<{ seq: number; color: string; size: number; eraser: boolean; points: [number, number][] }>`
      select seq, color, size, eraser, points
      from chalkboard_strokes
      where session_id = ${data.sessionId} and seq > ${data.afterSeq}
      order by seq asc limit 500`;
    return {
      strokes: rows.map((r) => ({
        seq: r.seq, color: r.color, size: r.size, eraser: r.eraser,
        points: Array.isArray(r.points) ? r.points : [],
      })),
      live: sess[0]?.is_live ?? false,
    };
  });

/** Clear the board mid-session (teacher). Pushes a clear marker. */
export const clearChalkboardSession = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { sessionId: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const sess = await sql<{ id: string }>`
      select id from chalkboard_sessions
      where id = ${data.sessionId} and teacher_id = ${context.userId} and is_live = true`;
    if (!sess.length) throw new Error("Session is not live.");
    await sql`delete from chalkboard_strokes where session_id = ${data.sessionId}`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Raise-hand queue                                                     */
/* ------------------------------------------------------------------ */

export interface RaisedHand {
  id: string;
  studentId: string;
  studentName: string;
  raisedAt: string;
  position: number;
}

/** Student raises their hand (one active raise per student per classroom). */
export const raiseHand = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("parent")])
  .validator((input: { classroomId: string; studentId: string; studentName: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await sql`insert into hand_raises (classroom_id, student_id, student_name)
      values (${data.classroomId}, ${data.studentId}, ${data.studentName})
      on conflict do nothing`;
    return { ok: true };
  });

/** Student lowers their hand. */
export const lowerHand = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("parent")])
  .validator((input: { classroomId: string; studentId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await sql`update hand_raises set status = 'lowered'
              where classroom_id = ${data.classroomId} and student_id = ${data.studentId}
              and status = 'raised'`;
    return { ok: true };
  });

/** Teacher sees the queue in order. */
export const getRaisedHands = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { classroomId: string }) => input)
  .handler(async ({ data }): Promise<{ hands: RaisedHand[] }> => {
    const sql = await getSql();
    const rows = await sql<{ id: string; student_id: string; student_name: string; raised_at: string }>`
      select id, student_id, student_name, raised_at::text as raised_at
      from hand_raises
      where classroom_id = ${data.classroomId} and status = 'raised'
      order by raised_at asc`;
    return {
      hands: rows.map((r, i) => ({
        id: r.id, studentId: r.student_id, studentName: r.student_name,
        raisedAt: r.raised_at, position: i + 1,
      })),
    };
  });

/** Teacher calls on a student — marks them called (clears their raise). */
export const callOnStudent = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { handId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await sql`update hand_raises set status = 'called', called_at = now() where id = ${data.handId}`;
    return { ok: true };
  });

/** Student checks: am I currently raising my hand? */
export const getMyHandStatus = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("parent")])
  .validator((input: { classroomId: string; studentId: string }) => input)
  .handler(async ({ data }): Promise<{ raised: boolean; position: number | null }> => {
    const sql = await getSql();
    const rows = await sql<{ id: string; raised_at: string }>`
      select id, raised_at::text as raised_at from hand_raises
      where classroom_id = ${data.classroomId} and student_id = ${data.studentId}
      and status = 'raised'`;
    if (!rows.length) return { raised: false, position: null };
    const ahead = await sql<{ n: string }>`
      select count(*)::text as n from hand_raises
      where classroom_id = ${data.classroomId} and status = 'raised'
      and raised_at < ${rows[0].raised_at}`;
    return { raised: true, position: Number(ahead[0].n) + 1 };
  });

/* ------------------------------------------------------------------ */
/* Quick polls / exit tickets                                          */
/* ------------------------------------------------------------------ */

export interface QuickPoll {
  id: string;
  question: string;
  options: string[];
  isOpen: boolean;
  createdAt: string;
  totalResponses: number;
  counts: number[];
  myChoice: number | null;
}

/** Teacher creates a poll (closes any open one first). */
export const createQuickPoll = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { classroomId: string; question: string; options: string[] }) => input)
  .handler(async ({ context, data }): Promise<{ pollId: string }> => {
    const sql = await getSql();
    const clean = data.options.map((o) => o.trim()).filter(Boolean).slice(0, 6);
    if (!data.question.trim() || clean.length < 2) {
      throw new Error("Give the poll a question and at least 2 options.");
    }
    await sql`update quick_polls set is_open = false, closed_at = now()
              where classroom_id = ${data.classroomId} and is_open = true`;
    const rows = await sql<{ id: string }>`
      insert into quick_polls (classroom_id, teacher_id, question, options)
      values (${data.classroomId}, ${context.userId}, ${data.question.trim()}, ${JSON.stringify(clean)}::jsonb)
      returning id`;
    return { pollId: rows[0].id };
  });

/** Teacher closes the poll. */
export const closeQuickPoll = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { pollId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await sql`update quick_polls set is_open = false, closed_at = now() where id = ${data.pollId}`;
    return { ok: true };
  });

/** Open poll for a classroom (students see it, teacher sees live results). */
export const getOpenPoll = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("teacher", "parent")])
  .validator((input: { classroomId: string; studentId?: string }) => input)
  .handler(async ({ data }): Promise<{ poll: QuickPoll | null }> => {
    const sql = await getSql();
    const rows = await sql<{ id: string; question: string; options: string[]; created_at: string }>`
      select id, question, options, created_at::text as created_at from quick_polls
      where classroom_id = ${data.classroomId} and is_open = true
      order by created_at desc limit 1`;
    if (!rows.length) return { poll: null };
    const p = rows[0];
    const options = Array.isArray(p.options) ? p.options : [];
    const counts = await sql<{ option_index: number; n: string }>`
      select option_index, count(*)::text as n from poll_responses
      where poll_id = ${p.id} group by option_index`;
    const tally = options.map((_, i) => Number(counts.find((c) => c.option_index === i)?.n ?? 0));
    let myChoice: number | null = null;
    if (data.studentId) {
      const mine = await sql<{ option_index: number }>`
        select option_index from poll_responses
        where poll_id = ${p.id} and student_id = ${data.studentId}`;
      myChoice = mine[0]?.option_index ?? null;
    }
    return {
      poll: {
        id: p.id, question: p.question, options, isOpen: true,
        createdAt: p.created_at,
        totalResponses: tally.reduce((a, b) => a + b, 0),
        counts: tally, myChoice,
      },
    };
  });

/** Student answers the poll (one answer, can change it). */
export const answerPoll = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("parent")])
  .validator((input: { pollId: string; studentId: string; studentName: string; optionIndex: number }) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const open = await sql<{ id: string }>`select id from quick_polls where id = ${data.pollId} and is_open = true`;
    if (!open.length) throw new Error("This poll is closed.");
    await sql`insert into poll_responses (poll_id, student_id, student_name, option_index)
      values (${data.pollId}, ${data.studentId}, ${data.studentName}, ${data.optionIndex})
      on conflict (poll_id, student_id)
      do update set option_index = excluded.option_index, created_at = now()`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Teacher Library — folders for materials, notes, and quick links     */
/* ------------------------------------------------------------------ */

export interface LibraryItem {
  id: string;
  kind: "material" | "note" | "link";
  title: string;
  refId: string | null;
  body: string | null;
  createdAt: string;
}

export interface LibraryFolder {
  id: string;
  name: string;
  items: LibraryItem[];
  createdAt: string;
}

const DEFAULT_FOLDERS = ["Teaching Materials", "Student Work", "Progress & Records"];

async function ensureLibrarySeed(sql: any, userId: string) {
  const existing = await sql<{ count: number }>`
    select count(*)::int as count from teacher_folders where user_id = ${userId}`;
  if ((existing[0]?.count ?? 0) > 0) return;
  for (const name of DEFAULT_FOLDERS) {
    await sql`insert into teacher_folders (user_id, name) values (${userId}, ${name})`;
  }
  // Seed quick links: Student Work -> assignments, Progress & Records -> progress
  const folders = await sql<{ id: string; name: string }>`
    select id, name from teacher_folders where user_id = ${userId}`;
  for (const f of folders) {
    if (f.name === "Student Work") {
      await sql`insert into teacher_library_items (user_id, folder_id, kind, title, ref_id, body)
        values (${userId}, ${f.id}, 'link', 'Assignment submissions', 'assignments',
                'Review and grade what students turned in.')`;
    }
    if (f.name === "Progress & Records") {
      await sql`insert into teacher_library_items (user_id, folder_id, kind, title, ref_id, body)
        values (${userId}, ${f.id}, 'link', 'Student progress', 'progress',
                'Per-student progress across lessons and Units.'),
               (${userId}, ${f.id}, 'link', 'Classroom records', 'records',
                'Import/export rosters and records.')`;
    }
  }
}

export const listLibrary = createServerFn({ method: "GET" })
  .middleware([roleMiddleware("teacher")])
  .handler(async ({ context }): Promise<{ folders: LibraryFolder[] }> => {
    const sql = await getSql();
    await ensureLibrarySeed(sql, context.userId);
    const folders = await sql<{ id: string; name: string; created_at: string }>`
      select id, name, created_at::text as created_at from teacher_folders
      where user_id = ${context.userId} order by created_at`;
    const items = await sql<{
      id: string; folder_id: string; kind: string; title: string;
      ref_id: string | null; body: string | null; created_at: string;
    }>`
      select id, folder_id, kind, title, ref_id, body, created_at::text as created_at
      from teacher_library_items
      where user_id = ${context.userId} order by created_at`;
    return {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        createdAt: f.created_at,
        items: items
          .filter((i) => i.folder_id === f.id)
          .map((i) => ({
            id: i.id,
            kind: i.kind as LibraryItem["kind"],
            title: i.title,
            refId: i.ref_id,
            body: i.body,
            createdAt: i.created_at,
          })),
      })),
    };
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { name: string }) => input)
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const sql = await getSql();
    const name = data.name.trim().slice(0, 40);
    if (!name) throw new Error("Folder needs a name.");
    const rows = await sql<{ id: string }>`
      insert into teacher_folders (user_id, name) values (${context.userId}, ${name})
      returning id`;
    return { id: rows[0].id };
  });

export const renameFolder = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string; name: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const name = data.name.trim().slice(0, 40);
    if (!name) throw new Error("Folder needs a name.");
    await sql`update teacher_folders set name = ${name}
              where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await sql`delete from teacher_folders where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true };
  });

export const addLibraryItem = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { folderId: string; kind: "material" | "note" | "link"; title: string; refId?: string; body?: string }) => input)
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const sql = await getSql();
    const folders = await sql<{ id: string }>`
      select id from teacher_folders where id = ${data.folderId} and user_id = ${context.userId}`;
    if (!folders.length) throw new Error("Folder not found.");
    const title = data.title.trim().slice(0, 80);
    if (!title) throw new Error("Item needs a title.");
    // Prevent duplicate saves of the same material/link into the same folder.
    if (data.kind !== "note" && data.refId) {
      const dupes = await sql<{ id: string }>`
        select id from teacher_library_items
        where user_id = ${context.userId} and folder_id = ${data.folderId}
          and kind = ${data.kind} and ref_id = ${data.refId}
        limit 1`;
      if (dupes.length) return { id: dupes[0].id };
    }
    const rows = await sql<{ id: string }>`
      insert into teacher_library_items (user_id, folder_id, kind, title, ref_id, body)
      values (${context.userId}, ${data.folderId}, ${data.kind}, ${title},
              ${data.refId ?? null}, ${data.body ?? null})
      returning id`;
    return { id: rows[0].id };
  });

export const removeLibraryItem = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    await sql`delete from teacher_library_items where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Teacher Library file uploads (Cloudflare R2)                         */
/* ------------------------------------------------------------------ */

import {
  r2Configured,
  r2UploadUrl,
  r2DownloadUrl,
  r2Delete,
  safeFileName,
  validateUpload,
} from "@/lib/r2";

export interface LibraryFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/** Step 1: get a presigned URL to upload directly to R2. */
export const getFileUploadUrl = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { folderId: string; fileName: string; mimeType: string; sizeBytes: number }) => input)
  .handler(async ({ context, data }): Promise<{ uploadUrl: string; fileKey: string }> => {
    if (!r2Configured()) {
      throw new Error("File uploads aren't set up yet — the R2 bucket needs connecting first.");
    }
    const sql = await getSql();
    const folders = await sql<{ id: string }>`
      select id from teacher_folders where id = ${data.folderId} and user_id = ${context.userId}`;
    if (!folders.length) throw new Error("Folder not found.");
    const problem = validateUpload(data.mimeType, data.sizeBytes);
    if (problem) throw new Error(problem);
    const fileKey = `teachers/${context.userId}/${data.folderId}/${Date.now()}-${safeFileName(data.fileName)}`;
    const uploadUrl = await r2UploadUrl(fileKey, data.mimeType);
    return { uploadUrl, fileKey };
  });

/** Step 2: after the browser PUTs to R2, record the file in the library. */
export const confirmFileUpload = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { folderId: string; fileKey: string; fileName: string; mimeType: string; sizeBytes: number }) => input)
  .handler(async ({ context, data }): Promise<{ file: LibraryFile }> => {
    const sql = await getSql();
    const folders = await sql<{ id: string }>`
      select id from teacher_folders where id = ${data.folderId} and user_id = ${context.userId}`;
    if (!folders.length) throw new Error("Folder not found.");
    // Only accept keys this server issued for this user+folder.
    const prefix = `teachers/${context.userId}/${data.folderId}/`;
    if (!data.fileKey.startsWith(prefix)) throw new Error("Invalid file key.");
    const problem = validateUpload(data.mimeType, data.sizeBytes);
    if (problem) throw new Error(problem);
    const rows = await sql<{
      id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string;
    }>`
      insert into teacher_library_files (user_id, folder_id, file_key, file_name, mime_type, size_bytes)
      values (${context.userId}, ${data.folderId}, ${data.fileKey},
              ${safeFileName(data.fileName)}, ${data.mimeType}, ${Math.floor(data.sizeBytes)})
      returning id, file_name, mime_type, size_bytes, created_at::text as created_at`;
    const r = rows[0];
    return {
      file: {
        id: r.id, fileName: r.file_name, mimeType: r.mime_type,
        sizeBytes: r.size_bytes, createdAt: r.created_at,
      },
    };
  });

export const listLibraryFiles = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { folderId: string }) => input)
  .handler(async ({ context, data }): Promise<{ files: LibraryFile[] }> => {
    const sql = await getSql();
    const rows = await sql<{
      id: string; file_name: string; mime_type: string; size_bytes: number; created_at: string;
    }>`
      select f.id, f.file_name, f.mime_type, f.size_bytes, f.created_at::text as created_at
      from teacher_library_files f
      join teacher_folders fo on fo.id = f.folder_id
      where f.folder_id = ${data.folderId} and fo.user_id = ${context.userId}
      order by f.created_at desc`;
    return {
      files: rows.map((r) => ({
        id: r.id, fileName: r.file_name, mimeType: r.mime_type,
        sizeBytes: r.size_bytes, createdAt: r.created_at,
      })),
    };
  });

export const getFileDownloadUrl = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { fileId: string }) => input)
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    if (!r2Configured()) throw new Error("File storage isn't connected yet.");
    const sql = await getSql();
    const rows = await sql<{ file_key: string; file_name: string }>`
      select f.file_key, f.file_name
      from teacher_library_files f
      join teacher_folders fo on fo.id = f.folder_id
      where f.id = ${data.fileId} and fo.user_id = ${context.userId}`;
    if (!rows.length) throw new Error("File not found.");
    return { url: await r2DownloadUrl(rows[0].file_key, rows[0].file_name) };
  });

export const deleteLibraryFile = createServerFn({ method: "POST" })
  .middleware([roleMiddleware("teacher")])
  .validator((input: { fileId: string }) => input)
  .handler(async ({ context, data }): Promise<{ ok: boolean }> => {
    const sql = await getSql();
    const rows = await sql<{ file_key: string; folder_id: string }>`
      select f.file_key, f.folder_id
      from teacher_library_files f
      join teacher_folders fo on fo.id = f.folder_id
      where f.id = ${data.fileId} and fo.user_id = ${context.userId}`;
    if (!rows.length) throw new Error("File not found.");
    // Delete from R2 first (best effort), then the record.
    try {
      await r2Delete(rows[0].file_key);
    } catch {
      /* fall through — still remove the record */
    }
    await sql`delete from teacher_library_files where id = ${data.fileId}`;
    return { ok: true };
  });
