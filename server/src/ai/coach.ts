import OpenAI from "openai";
import { questionSchema, scoreSchema, type SessionResult } from "../types.js";

const QUESTION_SYSTEM = `You are an interview coach. Given a role title and an optional resume snippet, write ONE interview question.
The question must be answerable from general knowledge of the role. Do not invent employers, projects, metrics, or skills that are not in the resume snippet.
If no resume is given, ask a standard behavioral or technical question for the role.
Return JSON only: { "question": string }.
The question must be 10–400 characters.`;

const SCORE_SYSTEM = `You are an interview coach scoring one answer.
Rubric (1–5 overall): clarity, relevance to the question, depth of example or reasoning.
Do not invent facts. Score only what the candidate wrote.
Then write a short feedback sentence and ONE follow-up question that digs into what they said (or asks for a missing example).
Return JSON only: { "score": number, "feedback": string, "followUp": string }.
score is an integer 1–5.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

export function heuristicQuestion(roleTitle: string, resumeSnippet?: string): SessionResult {
  const role = roleTitle.trim() || "this role";
  let question = `Tell me about a time you solved a difficult problem as a ${role}. What was the outcome?`;
  if (resumeSnippet && resumeSnippet.length > 40) {
    question = `Looking at your experience, walk me through a project that prepared you for the ${role} role. What was your contribution?`;
  }
  return {
    question,
    source: "heuristic",
  };
}

export function heuristicScore(question: string, answer: string): SessionResult {
  const words = answer.trim().split(/\s+/).length;
  let score = 2;
  if (words > 40) score = 4;
  else if (words > 20) score = 3;
  else if (words < 8) score = 1;

  const feedback =
    words < 15
      ? "The answer is short. Add a concrete example and the result."
      : "You gave some detail. A stronger answer would name the constraint and the measurable outcome.";

  const followUp = "What would you do differently if you faced the same situation again?";

  return {
    question,
    answer,
    score,
    feedback,
    followUp,
    source: "heuristic",
  };
}

async function callModel(client: OpenAI, model: string, system: string, user: string): Promise<string> {
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  try {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages,
    });
    return res.choices[0]?.message?.content ?? "";
  } catch {
    const res = await client.chat.completions.create({
      model,
      temperature: 0.3,
      messages,
    });
    return res.choices[0]?.message?.content ?? "";
  }
}

export async function generateQuestion(roleTitle: string, resumeSnippet?: string): Promise<SessionResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return heuristicQuestion(roleTitle, resumeSnippet);

  const client = new OpenAI({
    apiKey: key,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const user = `Role: ${roleTitle}\n\nResume snippet:\n${resumeSnippet || "(none)"}`;

  try {
    let text = await callModel(client, model, QUESTION_SYSTEM, user);
    let parsed = extractJson(text);
    let checked = questionSchema.safeParse(parsed);
    if (checked.success) {
      return { question: checked.data.question, source: "model", model };
    }

    text = await callModel(
      client,
      model,
      QUESTION_SYSTEM,
      `${user}\n\nPrevious output was invalid. Return only { "question": "..." }.`,
    );
    parsed = extractJson(text);
    checked = questionSchema.safeParse(parsed);
    if (checked.success) {
      return { question: checked.data.question, source: "model", model };
    }
  } catch {
    /* fall through */
  }

  const fallback = heuristicQuestion(roleTitle, resumeSnippet);
  return fallback;
}

export async function scoreAnswer(
  roleTitle: string,
  question: string,
  answer: string,
  resumeSnippet?: string,
): Promise<SessionResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return heuristicScore(question, answer);

  const client = new OpenAI({
    apiKey: key,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const user = `Role: ${roleTitle}\nQuestion: ${question}\nAnswer: ${answer}\nResume (optional context):\n${resumeSnippet || "(none)"}`;

  try {
    let text = await callModel(client, model, SCORE_SYSTEM, user);
    let parsed = extractJson(text);
    let checked = scoreSchema.safeParse(parsed);
    if (checked.success) {
      return {
        question,
        answer,
        score: checked.data.score,
        feedback: checked.data.feedback,
        followUp: checked.data.followUp,
        source: "model",
        model,
      };
    }

    text = await callModel(
      client,
      model,
      SCORE_SYSTEM,
      `${user}\n\nPrevious output was invalid. Return only { "score": 1-5, "feedback": "...", "followUp": "..." }.`,
    );
    parsed = extractJson(text);
    checked = scoreSchema.safeParse(parsed);
    if (checked.success) {
      return {
        question,
        answer,
        score: checked.data.score,
        feedback: checked.data.feedback,
        followUp: checked.data.followUp,
        source: "model",
        model,
      };
    }
  } catch {
    /* fall through */
  }

  return heuristicScore(question, answer);
}
