// Data access. MongoDB (via Mongoose) by default.
// DB_MODE=memory swaps in a throwaway in-memory store for quick demos and tests.
import mongoose from "mongoose";
import crypto from "node:crypto";
import { config } from "../config.js";
import { Run, Post, AuditEvent } from "../models/index.js";

const clean = (doc) => {
  if (!doc) return null;
  const { _id, __v, ...rest } = doc;
  const out = { id: String(_id), ...rest };
  if (out.run) out.run = String(out.run);
  return out;
};

const mongoStore = {
  async connect() {
    await mongoose.connect(config.mongoUri);
  },
  async createRun(data) {
    return clean((await Run.create(data)).toObject());
  },
  async updateRun(id, patch) {
    return clean(await Run.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean());
  },
  async getRun(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return clean(await Run.findById(id).lean());
  },
  async listRuns() {
    return (await Run.find().sort({ createdAt: -1 }).limit(50).lean()).map(clean);
  },
  async insertPosts(runId, posts) {
    const docs = await Post.insertMany(posts.map((p) => ({ ...p, run: runId })));
    return docs.map((d) => clean(d.toObject()));
  },
  async listPosts(runId) {
    if (!mongoose.isValidObjectId(runId)) return [];
    return (await Post.find({ run: runId }).sort({ slotId: 1 }).lean()).map(clean);
  },
  async countPosts(runIds) {
    const rows = await Post.aggregate([
      { $match: { run: { $in: runIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: { run: "$run", decision: "$decision" }, n: { $sum: 1 } } },
    ]);
    const out = {};
    for (const r of rows) {
      const k = String(r._id.run);
      out[k] ||= { total: 0, APPROVED: 0, REJECTED: 0, PENDING: 0 };
      out[k][r._id.decision] = r.n;
      out[k].total += r.n;
    }
    return out;
  },
  async getPost(id) {
    if (!mongoose.isValidObjectId(id)) return null;
    return clean(await Post.findById(id).lean());
  },
  async updatePost(id, patch) {
    return clean(await Post.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean());
  },
  async addEvent(runId, event, data) {
    await AuditEvent.create({ run: runId || undefined, event, data });
  },
  async listEvents(runId) {
    if (!mongoose.isValidObjectId(runId)) return [];
    return (await AuditEvent.find({ run: runId }).sort({ createdAt: 1, _id: 1 }).lean()).map(clean);
  },
};

function memoryStore() {
  const runs = new Map(), posts = new Map(), events = [];
  const id = () => crypto.randomBytes(12).toString("hex");
  const now = () => new Date().toISOString();
  const copy = (o) => (o ? structuredClone(o) : null);
  return {
    async connect() {},
    async createRun(data) {
      const r = { id: id(), status: "running", stage: { agent: "orchestrator" }, progress: [], flags: [], ...structuredClone(data), createdAt: now(), updatedAt: now() };
      runs.set(r.id, r);
      return copy(r);
    },
    async updateRun(rid, patch) {
      const r = runs.get(rid);
      if (!r) return null;
      Object.assign(r, structuredClone(patch), { updatedAt: now() });
      return copy(r);
    },
    async getRun(rid) { return copy(runs.get(rid)); },
    async listRuns() { return [...runs.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(copy); },
    async insertPosts(runId, list) {
      return list.map((p) => {
        const d = { id: id(), decision: "PENDING", edited: false, overrides: [], ...structuredClone(p), run: runId, createdAt: now(), updatedAt: now() };
        posts.set(d.id, d);
        return copy(d);
      });
    },
    async listPosts(runId) { return [...posts.values()].filter((p) => p.run === runId).sort((a, b) => a.slotId - b.slotId).map(copy); },
    async countPosts(runIds) {
      const out = {};
      for (const p of posts.values()) {
        if (!runIds.includes(p.run)) continue;
        out[p.run] ||= { total: 0, APPROVED: 0, REJECTED: 0, PENDING: 0 };
        out[p.run][p.decision]++;
        out[p.run].total++;
      }
      return out;
    },
    async getPost(pid) { return copy(posts.get(pid)); },
    async updatePost(pid, patch) {
      const p = posts.get(pid);
      if (!p) return null;
      Object.assign(p, structuredClone(patch), { updatedAt: now() });
      return copy(p);
    },
    async addEvent(runId, event, data) { events.push({ id: id(), run: runId, event, data: structuredClone(data), createdAt: now() }); },
    async listEvents(runId) { return events.filter((e) => e.run === runId).map(copy); },
  };
}

export const db = config.dbMode === "memory" ? memoryStore() : mongoStore;
