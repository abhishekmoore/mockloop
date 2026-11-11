import { z } from "zod";

export const questionSchema = z.object({
  question: z.string().min(10).max(500),
});

export const scoreSchema = z.object({
  score: z.number().min(1).max(5),
  feedback: z.string().min(5).max(800),
  followUp: z.string().min(10).max(500),
});

export type QuestionResult = z.infer<typeof questionSchema>;
export type ScoreResult = z.infer<typeof scoreSchema>;

export interface SessionResult {
  question: string;
  answer?: string;
  score?: number;
  feedback?: string;
  followUp?: string;
  source: "model" | "heuristic";
  model?: string;
}

export interface Session {
  id: string;
  roleTitle: string;
  resumeSnippet?: string;
  createdAt: string;
  result: SessionResult;
}

export interface SessionStore {
  insert(doc: Omit<Session, "id" | "createdAt">): Promise<Session>;
  list(limit: number): Promise<Session[]>;
  get(id: string): Promise<Session | null>;
  update(id: string, patch: Partial<SessionResult>): Promise<Session | null>;
  remove(id: string): Promise<boolean>;
}
