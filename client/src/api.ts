import axios from "axios";
import type { Session } from "./types";

const api = axios.create({ baseURL: "/api" });

export async function listSessions(): Promise<Session[]> {
  const { data } = await api.get<Session[]>("/sessions");
  return data;
}

export async function createSession(body: {
  roleTitle: string;
  resumeSnippet?: string;
}): Promise<Session> {
  const { data } = await api.post<Session>("/sessions", body);
  return data;
}

export async function submitAnswer(id: string, answer: string): Promise<Session> {
  const { data } = await api.post<Session>(`/sessions/${id}/answer`, { answer });
  return data;
}

export async function deleteSession(id: string): Promise<void> {
  await api.delete(`/sessions/${id}`);
}

export async function health(): Promise<{ ai: string; model: string; store: string }> {
  const { data } = await api.get("/health");
  return data;
}
