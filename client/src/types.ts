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
