import { test } from "node:test";
import assert from "node:assert/strict";
import { heuristicQuestion, heuristicScore } from "./coach.js";
import { format } from "date-fns";

test("heuristic question mentions the role", () => {
  const r = heuristicQuestion("Product manager");
  assert.equal(r.source, "heuristic");
  assert.match(r.question.toLowerCase(), /product manager/);
  assert.ok(r.question.length > 20);
});

test("heuristic question changes when resume is long enough", () => {
  const long = "Built a payments service that handled 10k TPS. Led a team of 5.";
  const r = heuristicQuestion("Backend engineer", long);
  assert.match(r.question.toLowerCase(), /project|experience|contribution/);
});

test("heuristic score is low for very short answers", () => {
  const r = heuristicScore("Tell me about a project.", "It was good.");
  assert.equal(r.source, "heuristic");
  assert.equal(r.score, 1);
  assert.ok(r.feedback && r.feedback.length > 5);
  assert.ok(r.followUp && r.followUp.length > 10);
});

test("heuristic score rises with longer answers", () => {
  const long =
    "I migrated the monolith to services. We cut p99 latency from 800ms to 120ms by moving the hot path to a queue and adding a cache. The team of four owned the rollout with feature flags.";
  const r = heuristicScore("Describe a system you improved.", long);
  assert.ok((r.score ?? 0) >= 3);
});

test("date-fns format returns a readable timestamp", () => {
  const iso = "2026-11-11T04:40:00.000Z";
  const out = format(new Date(iso), "MMM d, yyyy · h:mm a");
  assert.match(out, /Nov 11, 2026/);
});
