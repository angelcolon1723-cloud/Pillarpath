/* ------------------------------------------------------------------ */
/* PillarPath chore & earning-opportunity catalog                        */
/* Pre-seeded earning opportunities for the Parent workspace.           */
/* Parents can enable/disable, edit rewards, delete, or add their own.  */
/* ------------------------------------------------------------------ */

export type ChoreCategory =
  | "Household"
  | "Kitchen"
  | "Outdoor"
  | "Responsibility"
  | "Kindness"
  | "School & Learning";

export type ChoreTemplate = {
  id: string;
  name: string;
  amount: number;
  category: ChoreCategory;
};

export const CHORE_CATEGORIES: ChoreCategory[] = [
  "Household",
  "Kitchen",
  "Outdoor",
  "Responsibility",
  "Kindness",
  "School & Learning",
];

export const CHORE_SEED: ChoreTemplate[] = [
  /* ------------------------------ Household ------------------------------ */
  { id: "hh-make-bed", name: "Make your bed", amount: 5, category: "Household" },
  { id: "hh-clean-bedroom", name: "Clean your bedroom", amount: 10, category: "Household" },
  { id: "hh-do-dishes", name: "Do the dishes", amount: 8, category: "Household" },
  { id: "hh-take-out-trash", name: "Take out the trash", amount: 5, category: "Household" },
  { id: "hh-vacuum", name: "Vacuum a room", amount: 8, category: "Household" },
  { id: "hh-fold-laundry", name: "Fold the laundry", amount: 8, category: "Household" },
  { id: "hh-put-away-laundry", name: "Put away your laundry", amount: 6, category: "Household" },
  { id: "hh-dust", name: "Dust the living room", amount: 8, category: "Household" },
  { id: "hh-mop", name: "Mop the kitchen floor", amount: 10, category: "Household" },
  { id: "hh-bathroom-tidy", name: "Clean the bathroom sink & mirror", amount: 10, category: "Household" },
  { id: "hh-bathroom-deep", name: "Deep-clean the bathroom", amount: 20, category: "Household" },
  { id: "hh-organize-closet", name: "Organize your closet", amount: 12, category: "Household" },
  { id: "hh-organize-drawer", name: "Organize a drawer or shelf", amount: 6, category: "Household" },
  { id: "hh-clean-windows", name: "Clean windows (inside)", amount: 10, category: "Household" },
  { id: "hh-baseboards", name: "Wipe the baseboards", amount: 8, category: "Household" },
  { id: "hh-garage", name: "Tidy the garage", amount: 15, category: "Household" },
  { id: "hh-pantry", name: "Organize the pantry", amount: 10, category: "Household" },
  { id: "hh-feed-pets", name: "Feed the pets", amount: 5, category: "Household" },
  { id: "hh-walk-dog", name: "Walk the dog", amount: 10, category: "Household" },
  { id: "hh-pet-area", name: "Clean the pet area", amount: 8, category: "Household" },
  { id: "hh-water-plants", name: "Water the indoor plants", amount: 5, category: "Household" },

  /* ------------------------------- Kitchen ------------------------------- */
  { id: "kt-set-table", name: "Set the table", amount: 4, category: "Kitchen" },
  { id: "kt-clear-table", name: "Clear the table", amount: 4, category: "Kitchen" },
  { id: "kt-help-cook", name: "Help cook dinner", amount: 12, category: "Kitchen" },
  { id: "kt-pack-lunch", name: "Pack your lunch", amount: 6, category: "Kitchen" },
  { id: "kt-wipe-counters", name: "Wipe the kitchen counters", amount: 6, category: "Kitchen" },
  { id: "kt-unload-dishwasher", name: "Unload the dishwasher", amount: 6, category: "Kitchen" },
  { id: "kt-sweep-kitchen", name: "Sweep the kitchen", amount: 6, category: "Kitchen" },
  { id: "kt-groceries", name: "Help unpack groceries", amount: 8, category: "Kitchen" },
  { id: "kt-bake", name: "Bake something with a parent", amount: 15, category: "Kitchen" },

  /* ------------------------------- Outdoor ------------------------------- */
  { id: "od-mow-lawn", name: "Mow the lawn", amount: 25, category: "Outdoor" },
  { id: "od-rake-leaves", name: "Rake the leaves", amount: 15, category: "Outdoor" },
  { id: "od-shovel-snow", name: "Shovel the snow", amount: 20, category: "Outdoor" },
  { id: "od-weed-garden", name: "Weed the garden", amount: 12, category: "Outdoor" },
  { id: "od-plant", name: "Plant flowers or vegetables", amount: 15, category: "Outdoor" },
  { id: "od-wash-car", name: "Wash the car", amount: 20, category: "Outdoor" },
  { id: "od-sweep-porch", name: "Sweep the porch or driveway", amount: 8, category: "Outdoor" },
  { id: "od-bins-curb", name: "Take bins to the curb", amount: 5, category: "Outdoor" },
  { id: "od-bins-back", name: "Bring the bins back in", amount: 4, category: "Outdoor" },
  { id: "od-yard-cleanup", name: "Clean up the yard", amount: 12, category: "Outdoor" },
  { id: "od-water-garden", name: "Water the garden", amount: 6, category: "Outdoor" },

  /* ---------------------------- Responsibility ---------------------------- */
  { id: "rs-homework", name: "Finish homework on time", amount: 8, category: "Responsibility" },
  { id: "rs-read-20", name: "Read for 20 minutes", amount: 8, category: "Responsibility" },
  { id: "rs-practice-instrument", name: "Practice instrument for 20 minutes", amount: 10, category: "Responsibility" },
  { id: "rs-brush-teeth", name: "Brush teeth morning & night", amount: 5, category: "Responsibility" },
  { id: "rs-ready-on-time", name: "Get ready for school on time", amount: 6, category: "Responsibility" },
  { id: "rs-pack-bag", name: "Pack school bag the night before", amount: 5, category: "Responsibility" },
  { id: "rs-shower", name: "Shower without being asked", amount: 5, category: "Responsibility" },
  { id: "rs-tidy-desk", name: "Keep desk tidy for a week", amount: 12, category: "Responsibility" },
  { id: "rs-no-screens", name: "One full day with no screens", amount: 15, category: "Responsibility" },

  /* ------------------------------- Kindness ------------------------------- */
  { id: "kn-help-sibling", name: "Help a sibling with homework", amount: 10, category: "Kindness" },
  { id: "kn-thank-you", name: "Write a thank-you note", amount: 8, category: "Kindness" },
  { id: "kn-donate", name: "Donate toys or clothes", amount: 15, category: "Kindness" },
  { id: "kn-help-neighbor", name: "Help a neighbor", amount: 15, category: "Kindness" },
  { id: "kn-volunteer", name: "Volunteer for one hour", amount: 25, category: "Kindness" },
  { id: "kn-call-grandparents", name: "Call your grandparents", amount: 8, category: "Kindness" },
  { id: "kn-share", name: "Share without being asked", amount: 6, category: "Kindness" },
  { id: "kn-compliment", name: "Give someone a genuine compliment", amount: 4, category: "Kindness" },
  { id: "kn-help-parent", name: "Help a parent without being asked", amount: 10, category: "Kindness" },

  /* ---------------------------- School & Learning ---------------------------- */
  { id: "sl-complete-lesson", name: "Complete a PillarPath lesson", amount: 10, category: "School & Learning" },
  { id: "sl-ace-quiz", name: "Ace a quiz (90% or more)", amount: 15, category: "School & Learning" },
  { id: "sl-early-assignment", name: "Finish an assignment a day early", amount: 12, category: "School & Learning" },
  { id: "sl-spelling", name: "Perfect score on spelling test", amount: 12, category: "School & Learning" },
  { id: "sl-read-book", name: "Read a whole book", amount: 25, category: "School & Learning" },
  { id: "sl-teach", name: "Teach someone what you learned", amount: 15, category: "School & Learning" },
  { id: "sl-library", name: "Library visit + mini book report", amount: 20, category: "School & Learning" },
  { id: "sl-project", name: "Reach a project milestone", amount: 20, category: "School & Learning" },
];

/* ------------------------------------------------------------------ */
/* Teacher classroom earning activities (classroom Units — separate     */
/* from family Units). Teachers can edit, delete, and add their own.   */
/* ------------------------------------------------------------------ */

export type ClassroomActivityTemplate = {
  id: string;
  name: string;
  amount: number;
  hint: string;
};

export const CLASSROOM_ACTIVITY_SEED: ClassroomActivityTemplate[] = [
  { id: "ca-participation", name: "Class participation", amount: 5, hint: "Joining in, asking and answering" },
  { id: "ca-completed-assignment", name: "Completed assignment", amount: 10, hint: "Finished and submitted on time" },
  { id: "ca-perfect-score", name: "Perfect assignment score", amount: 15, hint: "Top marks on an assignment" },
  { id: "ca-milestone", name: "Learning milestone reached", amount: 25, hint: "Big curriculum checkpoint cleared" },
  { id: "ca-teamwork", name: "Teamwork star", amount: 15, hint: "Working well with classmates" },
  { id: "ca-help-classmate", name: "Helped a classmate", amount: 10, hint: "Peer support in class" },
  { id: "ca-savings-challenge", name: "Savings challenge complete", amount: 20, hint: "Classroom savings challenge" },
  { id: "ca-budget-challenge", name: "Budget challenge complete", amount: 20, hint: "Classroom budget challenge" },
  { id: "ca-pitch", name: "Entrepreneurship pitch", amount: 25, hint: "Presented a business idea" },
  { id: "ca-creative", name: "Creative project submitted", amount: 15, hint: "Creative Studio assignment" },
  { id: "ca-reading-streak", name: "Reading streak — 5 days", amount: 15, hint: "Five days of reading in a row" },
  { id: "ca-great-question", name: "Great question asked", amount: 5, hint: "Curiosity that moved the class forward" },
];
