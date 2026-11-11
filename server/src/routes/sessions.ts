import { Router } from "express";
import { z } from "zod";
import { generateQuestion, scoreAnswer } from "../ai/coach.js";
import type { SessionStore } from "../types.js";

const startSchema = z.object({
  roleTitle: z.string().min(3).max(120),
  resumeSnippet: z.string().max(4000).optional(),
});

const answerSchema = z.object({
  answer: z.string().min(10).max(4000),
});

export function sessionsRouter(store: SessionStore) {
  const router = Router();

  router.get("/", async (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const rows = await store.list(limit);
    res.json(rows);
  });

  router.post("/", async (req, res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "roleTitle is required (3–120 characters)." });
      return;
    }
    const { roleTitle, resumeSnippet } = parsed.data;
    const result = await generateQuestion(roleTitle, resumeSnippet);
    const saved = await store.insert({
      roleTitle,
      resumeSnippet,
      result,
    });
    res.status(201).json(saved);
  });

  router.post("/:id/answer", async (req, res) => {
    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "answer must be 10–4,000 characters." });
      return;
    }
    const session = await store.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (session.result.answer) {
      res.status(400).json({ error: "This session already has an answer." });
      return;
    }
    const scored = await scoreAnswer(
      session.roleTitle,
      session.result.question,
      parsed.data.answer,
      session.resumeSnippet,
    );
    const updated = await store.update(session.id, {
      answer: parsed.data.answer,
      score: scored.score,
      feedback: scored.feedback,
      followUp: scored.followUp,
      source: scored.source,
      model: scored.model,
    });
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  });

  router.get("/:id", async (req, res) => {
    const row = await store.get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  });

  router.delete("/:id", async (req, res) => {
    const ok = await store.remove(req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  });

  return router;
}
