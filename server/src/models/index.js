import mongoose from "mongoose";

const { Schema } = mongoose;

const IssueSchema = new Schema(
  { source: String, rule: Number, category: String, message: String },
  { _id: false }
);

const RunSchema = new Schema(
  {
    brief: {
      name: String,
      type: String,
      voice: String,
      goal: String,
      promo: String,
      prices: [{ _id: false, item: String, price: Number }],
      count: Number,
      simulateStubbornWriter: { type: Boolean, default: false },
    },
    status: { type: String, enum: ["running", "awaiting_approval", "completed", "failed"], default: "running" },
    // Live progress for the UI: which agent is working and how each slot is doing
    stage: { type: Schema.Types.Mixed, default: { agent: "orchestrator" } },
    progress: { type: [Schema.Types.Mixed], default: [] },
    flags: { type: [String], default: [] },
    llmMode: String,
    error: String,
  },
  { timestamps: true }
);

const PostSchema = new Schema(
  {
    run: { type: Schema.Types.ObjectId, ref: "Run", index: true, required: true },
    slotId: Number,
    day: String,
    time: String,
    type: String,
    theme: String,
    caption: String,
    hashtags: [String],
    imageIdea: String,
    issues: [IssueSchema],
    trail: [{ _id: false, attempt: Number, caption: String, issues: [IssueSchema] }],
    status: { type: String, enum: ["READY_FOR_APPROVAL", "NEEDS_HUMAN_ATTENTION"] },
    // Only the human approval route can change this
    decision: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING" },
    edited: { type: Boolean, default: false },
    overrides: { type: [String], default: [] },
  },
  { timestamps: true }
);

const AuditEventSchema = new Schema(
  {
    run: { type: Schema.Types.ObjectId, ref: "Run", index: true },
    event: { type: String, required: true },
    data: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Run = mongoose.model("Run", RunSchema);
export const Post = mongoose.model("Post", PostSchema);
export const AuditEvent = mongoose.model("AuditEvent", AuditEventSchema);
