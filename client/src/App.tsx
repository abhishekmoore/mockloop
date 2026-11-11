import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { listSessions, createSession, submitAnswer, deleteSession, health } from "./api";
import type { Session } from "./types";

type StartForm = { roleTitle: string; resumeSnippet: string };
type AnswerForm = { answer: string };

export default function App() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const healthQ = useQuery({ queryKey: ["health"], queryFn: health });
  const listQ = useQuery({ queryKey: ["sessions"], queryFn: listSessions });

  const startForm = useForm<StartForm>({ defaultValues: { roleTitle: "", resumeSnippet: "" } });
  const answerForm = useForm<AnswerForm>({ defaultValues: { answer: "" } });

  const createMut = useMutation({
    mutationFn: createSession,
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setSelected(row.id);
      startForm.reset();
      answerForm.reset();
    },
  });

  const answerMut = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) => submitAnswer(id, answer),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setSelected(row.id);
      answerForm.reset();
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      setSelected(null);
    },
  });

  const rows = listQ.data ?? [];
  const current = rows.find((r) => r.id === selected) ?? null;

  const onStart = startForm.handleSubmit((data) => {
    createMut.mutate({
      roleTitle: data.roleTitle,
      resumeSnippet: data.resumeSnippet.trim() || undefined,
    });
  });

  const onAnswer = answerForm.handleSubmit((data) => {
    if (!current) return;
    answerMut.mutate({ id: current.id, answer: data.answer });
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">MockLoop</h1>
            <p className="text-sm text-slate-600">Interview coach. One question, a scored answer, one follow-up.</p>
          </div>
          <div className="text-xs text-slate-500">
            {healthQ.data
              ? healthQ.data.ai === "model"
                ? `model · ${healthQ.data.model}`
                : "offline coach"
              : "…"}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-6 md:grid-cols-[1fr_280px]">
        <section className="space-y-4">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <form onSubmit={onStart} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Role title</label>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  placeholder="Senior backend engineer"
                  {...startForm.register("roleTitle", { required: true, minLength: 3 })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Resume snippet (optional)</label>
                <textarea
                  className="h-24 w-full rounded border px-3 py-2 text-sm"
                  placeholder="Paste a few lines from your resume if you want a more specific question."
                  {...startForm.register("resumeSnippet")}
                />
              </div>
              <button
                type="submit"
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                disabled={createMut.isPending || !startForm.watch("roleTitle").trim()}
              >
                {createMut.isPending ? "Asking…" : "Start session"}
              </button>
            </form>
            {createMut.isError && <p className="mt-2 text-sm text-red-600">Could not start. Check the API.</p>}
          </div>

          {current && (
            <SessionView
              session={current}
              answerForm={answerForm}
              onAnswer={onAnswer}
              answering={answerMut.isPending}
              onDelete={() => deleteMut.mutate(current.id)}
              deleting={deleteMut.isPending}
            />
          )}
        </section>

        <aside>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sessions</h2>
          {listQ.isPending && <p className="text-sm text-slate-500">Loading…</p>}
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  className={`w-full rounded border px-3 py-2 text-left text-sm ${
                    selected === row.id ? "border-slate-900 bg-slate-100" : "bg-white"
                  }`}
                  onClick={() => setSelected(row.id)}
                >
                  <div className="font-medium">{row.roleTitle}</div>
                  <div className="text-xs text-slate-500">
                    {format(new Date(row.createdAt), "MMM d, yyyy · h:mm a")}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}

function SessionView({
  session,
  answerForm,
  onAnswer,
  answering,
  onDelete,
  deleting,
}: {
  session: Session;
  answerForm: ReturnType<typeof useForm<AnswerForm>>;
  onAnswer: (e?: React.BaseSyntheticEvent) => Promise<void>;
  answering: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const r = session.result;
  const hasAnswer = Boolean(r.answer);

  return (
    <article className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{session.roleTitle}</h2>
          <p className="text-sm text-slate-500">
            {format(new Date(session.createdAt), "MMMM d, yyyy · h:mm a")} ·{" "}
            {r.source === "model" ? `model${r.model ? ` (${r.model})` : ""}` : "offline coach"}
          </p>
        </div>
        <button className="text-sm text-red-600 disabled:opacity-50" disabled={deleting} onClick={onDelete}>
          Delete
        </button>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Question</h3>
        <p className="mt-1 text-sm">{r.question}</p>
      </div>

      {!hasAnswer ? (
        <form onSubmit={onAnswer} className="space-y-2">
          <label className="block text-sm font-medium">Your answer</label>
          <textarea
            className="h-32 w-full rounded border px-3 py-2 text-sm"
            placeholder="Type your answer…"
            {...answerForm.register("answer", { required: true, minLength: 10 })}
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={answering}
          >
            {answering ? "Scoring…" : "Submit answer"}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Answer</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{r.answer}</p>
          </div>
          {typeof r.score === "number" && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Score</h3>
              <p className="mt-1 text-sm font-medium">{r.score}/5</p>
              {r.feedback && <p className="mt-1 text-sm text-slate-700">{r.feedback}</p>}
            </div>
          )}
          {r.followUp && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Follow-up</h3>
              <p className="mt-1 text-sm">{r.followUp}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
