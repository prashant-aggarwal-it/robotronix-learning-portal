import type { BatchSummary, CourseBlueprint, LearnerSummary, TrainerSummary } from "./types";

export const pythonCourse: CourseBlueprint = {
  id: "python-beginner",
  slug: "python-beginner",
  title: "Python Programming",
  level: "Beginner → Applied Builder",
  totalSessions: 24,
  modules: [
    {
      id: "m1",
      title: "Foundations & Decisions",
      sessions: [
        [1, "Hello Python", "lesson", 10, "Set up Python and create the first useful program."],
        [2, "Variables & Input", "lesson", 10, "Store information and interact with the user."],
        [3, "Numbers & Operators", "lesson", 10, "Use calculations inside practical programs."],
        [4, "Quick Check 1", "quick_check", 15, "Short diagnostic check — no school-style pressure."],
        [5, "Conditions", "lesson", 10, "Make programs choose what to do."],
        [6, "Nested Decisions", "lesson", 10, "Build richer decision logic."],
        [7, "Mini Build", "project", 30, "Create a ticket-price helper."],
        [8, "Milestone 1", "assessment", 40, "Present, assess and reflect on the first build."],
      ].map(([position, title, kind, xp, summary]) => ({ id: `s${position}`, position: position as number, title: title as string, kind: kind as any, xp: xp as number, summary: summary as string })),
    },
    {
      id: "m2",
      title: "Logic, Collections & Functions",
      sessions: [
        [9, "For Loops", "lesson", 10, "Repeat predictable tasks efficiently."],
        [10, "While Loops", "lesson", 10, "Repeat until a condition changes."],
        [11, "Strings", "lesson", 10, "Work with real text-based data."],
        [12, "Lists & Dictionaries", "lesson", 15, "Organise collections of useful information."],
        [13, "Functions", "lesson", 15, "Break programs into reusable building blocks."],
        [14, "OOP in Context", "lesson", 15, "Introduce objects through a small app rather than theory."],
        [15, "Applied Project", "project", 35, "Build a quiz or score-tracker application."],
        [16, "Milestone 2", "assessment", 40, "Project demonstration plus practical assessment."],
      ].map(([position, title, kind, xp, summary]) => ({ id: `s${position}`, position: position as number, title: title as string, kind: kind as any, xp: xp as number, summary: summary as string })),
    },
    {
      id: "m3",
      title: "GUI, Data & Capstone",
      sessions: [
        [17, "GUI Foundations", "lesson", 15, "Turn code into a usable visual application."],
        [18, "Forms & Validation", "lesson", 15, "Collect and validate user input."],
        [19, "Database Thinking", "lesson", 15, "Understand tables, records and CRUD through a project."],
        [20, "Python + Database", "lesson", 20, "Connect an application to stored data."],
        [21, "Error Handling in Context", "lesson", 10, "Make the capstone more reliable when things go wrong."],
        [22, "Capstone Build I", "project", 30, "Plan and begin the final application."],
        [23, "Capstone Build II", "project", 30, "Finish, test and polish the application."],
        [24, "Final Showcase", "assessment", 50, "Present the capstone, reflect and receive the final pathway recommendation."],
      ].map(([position, title, kind, xp, summary]) => ({ id: `s${position}`, position: position as number, title: title as string, kind: kind as any, xp: xp as number, summary: summary as string })),
    },
  ],
};

const baseNames = [
  "Aarav Mehta", "Riya Kapoor", "Nimit Jalan", "Avanthika L.", "Kabir Sharma",
  "Anaya Gupta", "Vihaan Arora", "Myra Jain", "Arjun Bansal", "Sara Khanna",
  "Advait Malhotra", "Ira Sethi", "Reyansh Verma", "Kiara Anand", "Dhruv Singhal",
  "Aanya Bhatia", "Vivaan Goel", "Meher Arora", "Atharv Jain", "Navya Gupta",
  "Yuvaan Kapoor", "Saanvi Mehta", "Aarush Sethi", "Anvi Bansal", "Kiaan Malhotra"
];

export const learners: LearnerSummary[] = baseNames.map((name, i) => {
  const courseOptions = ["Python Programming", "Scratch Coding", "Arduino Robotics", "Web Development"];
  const progress = Math.min(92, 28 + ((i * 11) % 63));
  const attendance = 76 + ((i * 7) % 25);
  const latestQuiz = 55 + ((i * 9) % 43);
  const status = attendance < 80 || latestQuiz < 60 ? "reinforce" : "on_track";
  return {
    id: i === 0 ? "aarav-mehta" : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    grade: `Grade ${6 + (i % 4)}`,
    course: courseOptions[i % courseOptions.length],
    courseSlug: i % 4 === 0 ? "python-beginner" : courseOptions[i % courseOptions.length].toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    trainer: courseOptions[i % courseOptions.length] === "Arduino Robotics" ? "Shamsher Singh" : courseOptions[i % courseOptions.length] === "Scratch Coding" ? "Arvind Kumar" : "Vikas Sharma",
    progress,
    sessionsCompleted: Math.round((progress / 100) * 24),
    totalSessions: 24,
    attendance,
    latestQuiz,
    projectsCompleted: 2 + (i % 5),
    xp: 280 + i * 17,
    status: status as any,
    nextFocus: i % 3 === 0 ? "Independent problem solving" : i % 3 === 1 ? "Project presentation" : "Debugging confidence",
  };
});

learners[0] = {
  ...learners[0],
  course: "Python Programming",
  courseSlug: "python-beginner",
  trainer: "Vikas Sharma",
  progress: 50,
  sessionsCompleted: 12,
  attendance: 92,
  latestQuiz: 80,
  projectsCompleted: 4,
  xp: 610,
  status: "on_track",
  nextFocus: "Write functions more independently",
};

export const trainers: TrainerSummary[] = [
  { id: "vikas", name: "Vikas Sharma", specialties: ["Python", "Web", "Data"], activeLearners: 8, activeBatches: 2, pendingReviews: 2 },
  { id: "shamsher", name: "Shamsher Singh", specialties: ["Arduino", "IoT", "Electronics"], activeLearners: 5, activeBatches: 1, pendingReviews: 1 },
  { id: "arvind", name: "Arvind Kumar", specialties: ["Scratch", "Mobile Apps"], activeLearners: 7, activeBatches: 1, pendingReviews: 3 },
  { id: "meera", name: "Meera Iyer", specialties: ["AI", "Data Analytics"], activeLearners: 0, activeBatches: 0, pendingReviews: 0 },
  { id: "nandita", name: "Nandita Rao", specialties: ["Java", "Computer Science"], activeLearners: 0, activeBatches: 0, pendingReviews: 0 },
];

export const batches: BatchSummary[] = [
  { id: "cohort-python-sep", name: "Python Creators · Sep 2026", course: "Python Programming", trainer: "Vikas Sharma", deliveryMode: "small_group", schedule: "Wed & Sat · 5:00 PM", learnerCount: 3, progress: 46 },
  { id: "cohort-arduino-sep", name: "Arduino Builders · Sep 2026", course: "Arduino Robotics", trainer: "Shamsher Singh", deliveryMode: "small_group", schedule: "Sat · 11:00 AM", learnerCount: 3, progress: 58 },
  { id: "cohort-scratch-sep", name: "Scratch Game Makers · Sep 2026", course: "Scratch Coding", trainer: "Arvind Kumar", deliveryMode: "small_group", schedule: "Tue & Thu · 4:00 PM", learnerCount: 4, progress: 35 },
];

export const aaravProjects = [
  { title: "Smart Calculator", status: "Presented", skills: ["Variables", "Operators", "Functions"], score: 88 },
  { title: "Ticket Price Helper", status: "Presented", skills: ["Input", "Conditions"], score: 84 },
  { title: "Number Guessing Game", status: "Completed", skills: ["Loops", "Random", "Logic"], score: 90 },
  { title: "Score Tracker", status: "In progress", skills: ["Lists", "Functions"], score: null },
];
