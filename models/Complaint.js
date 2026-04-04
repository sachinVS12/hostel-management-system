const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: [
      "maintenance",
      "electricity",
      "plumbing",
      "cleaning",
      "food",
      "other",
    ],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "in-progress", "resolved", "rejected"],
    default: "pending",
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },
  adminResponse: String,
  images: [String],
  resolvedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Complaint", complaintSchema);
