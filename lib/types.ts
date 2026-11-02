export type Role = "superadmin" | "specialist" | "teacher" | "student";
export interface User {
  id: string;
  org: string | null;
  classId: string | null;
  name: string;
  login: string;
  role: Role;
  blocked: boolean;
  mustChange: boolean;
  hash?: string;
  authId?: string;
}
export interface Organization {
  id: string;
  name: string;
  city: string;
  status: "active" | "suspended" | "archived";
  limit: number;
}
export interface SchoolClass {
  id: string;
  org: string;
  name: string;
  teacherId: string | null;
}
export interface Question {
  id: string;
  org: string | null;
  text: string;
  family: "riasec" | "klimov" | "skills";
  scale: string;
  reverse: boolean;
  active: boolean;
  version: number;
}
export interface Career {
  id: string;
  org: string | null;
  name: string;
  description: string;
  task: string;
  sector: string;
  route: string;
  skills: string[];
  subjects: string[];
  targets: Record<string, number>;
  tags: string[];
  active: boolean;
}
export interface Survey {
  id: string;
  org: string;
  owner: string;
  answers: Record<string, string | string[]>;
  complete: boolean;
  updatedAt: string;
}
export interface Assignment {
  id: string;
  org: string;
  title: string;
  recipients: string[];
  classId: string | null;
  createdAt: string;
  closesAt: string | null;
  maxAttempts: number;
}
export interface Attempt {
  id: string;
  org: string;
  owner: string;
  assignmentId: string;
  questions: Question[];
  survey: Survey;
  answers: Record<string, number>;
  timings: Record<string, number>;
  status: "active" | "completed";
  version: number;
  createdAt: string;
  completedAt?: string;
  result?: AssessmentResult;
}
export interface AssessmentResult {
  scores: Record<string, number>;
  top: {
    id: string;
    name: string;
    index: number;
    reasons: string[];
    components: Record<string, number>;
  }[];
  flags: string[];
  methodology: string;
  completedAt: string;
}
export interface Training {
  id: string;
  org: string;
  title: string;
  description: string;
  date: string;
  classIds: string[];
  url: string;
  status: "published" | "cancelled";
  attendance: Record<string, string>;
}
export interface Comment {
  id: string;
  org: string;
  owner: string;
  authorId: string;
  authorName: string;
  text: string;
  visibility: "student" | "staff";
  createdAt: string;
}
export interface Favorite {
  id: string;
  org: string;
  owner: string;
  careerId: string;
}
export interface Session {
  id: string;
  userId: string;
  expires: number;
}
export interface Audit {
  id: string;
  org: string | null;
  actor: string;
  action: string;
  createdAt: string;
}
export interface ImportJob {
  id: string;
  org: string;
  actor: string;
  key: string;
  completed: boolean;
  rows: { name: string; login: string; classId: string }[];
}
export interface EntityMap {
  materials: Material;
  feedback: Feedback;
  users: User;
  organizations: Organization;
  classes: SchoolClass;
  questions: Question;
  careers: Career;
  surveys: Survey;
  assignments: Assignment;
  attempts: Attempt;
  trainings: Training;
  comments: Comment;
  favorites: Favorite;
  sessions: Session;
  audit: Audit;
  imports: ImportJob;
}
export type Kind = keyof EntityMap;
export const roleNames: Record<Role, string> = {
  superadmin: "Супер әкімші",
  specialist: "Кәсіби бағдар маманы",
  teacher: "Сынып жетекшісі",
  student: "Оқушы",
};
export interface Material {
  id: string;
  org: string;
  trainingId: string;
  filename: string;
  mime: string;
  size: number;
  key: string;
}
export interface Feedback {
  id: string;
  org: string;
  owner: string;
  trainingId: string;
  rating: number;
  text: string;
  createdAt: string;
}
