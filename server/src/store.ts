import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";
import type { Session, SessionStore, SessionResult } from "./types.js";

const memory: Session[] = [];

export function createMemoryStore(): SessionStore {
  return {
    async insert(doc) {
      const row: Session = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        ...doc,
      };
      memory.unshift(row);
      return row;
    },
    async list(limit) {
      return memory.slice(0, limit);
    },
    async get(id) {
      return memory.find((r) => r.id === id) ?? null;
    },
    async update(id, patch) {
      const row = memory.find((r) => r.id === id);
      if (!row) return null;
      row.result = { ...row.result, ...patch };
      return row;
    },
    async remove(id) {
      const i = memory.findIndex((r) => r.id === id);
      if (i === -1) return false;
      memory.splice(i, 1);
      return true;
    },
  };
}

const SessionModel = mongoose.models.Session || mongoose.model(
  "Session",
  new Schema(
    {
      roleTitle: String,
      resumeSnippet: String,
      result: Schema.Types.Mixed,
      createdAt: String,
    },
    { versionKey: false },
  ),
);

export async function createMongoStore(uri: string): Promise<SessionStore> {
  await mongoose.connect(uri);
  return {
    async insert(doc) {
      const created = await SessionModel.create({
        ...doc,
        createdAt: new Date().toISOString(),
      });
      return { id: created._id.toString(), ...doc, createdAt: created.createdAt };
    },
    async list(limit) {
      const rows = await SessionModel.find().sort({ createdAt: -1 }).limit(limit).lean();
      return rows.map((r: any) => ({
        id: r._id.toString(),
        roleTitle: r.roleTitle,
        resumeSnippet: r.resumeSnippet,
        result: r.result,
        createdAt: r.createdAt,
      }));
    },
    async get(id) {
      if (!mongoose.isValidObjectId(id)) return null;
      const r = await SessionModel.findById(id).lean();
      if (!r || Array.isArray(r)) return null;
      return {
        id: (r._id as { toString(): string }).toString(),
        roleTitle: r.roleTitle as string,
        resumeSnippet: r.resumeSnippet as string | undefined,
        result: r.result as SessionResult,
        createdAt: r.createdAt as string,
      };
    },
    async update(id, patch) {
      if (!mongoose.isValidObjectId(id)) return null;
      const existing = await SessionModel.findById(id);
      if (!existing) return null;
      existing.result = { ...(existing.result as object), ...patch };
      await existing.save();
      return {
        id: existing._id.toString(),
        roleTitle: existing.roleTitle as string,
        resumeSnippet: existing.resumeSnippet as string | undefined,
        result: existing.result as SessionResult,
        createdAt: existing.createdAt as string,
      };
    },
    async remove(id) {
      if (!mongoose.isValidObjectId(id)) return false;
      const res = await SessionModel.deleteOne({ _id: id });
      return res.deletedCount === 1;
    },
  };
}

export async function connectStore(): Promise<SessionStore> {
  const uri = process.env.MONGO_URI;
  if (uri) return createMongoStore(uri);
  return createMemoryStore();
}
