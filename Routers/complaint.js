const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAllComplaints,
  getComplaintById,
  createComplaint,
  updateComplaint,
  updateComplaintStatus,
  deleteComplaint,
  getComplaintsByStatus,
  getComplaintStats,
  addComment,
  getComplaintsByStudent,
} = require("../controllers/complaintController");

// All routes require authentication
router.use(protect);

// Routes accessible by both admin and student (with different data)
router.get("/", getAllComplaints);
router.get("/stats", authorize("admin"), getComplaintStats);
router.get("/status/:status", authorize("admin"), getComplaintsByStatus);
router.get("/student/:studentId", authorize("admin"), getComplaintsByStudent);
router.post("/", createComplaint);
router.get("/:id", getComplaintById);

// Admin only routes
router.put("/:id", authorize("admin"), updateComplaint);
router.put("/:id/status", authorize("admin"), updateComplaintStatus);
router.delete("/:id", authorize("admin"), deleteComplaint);
router.post("/:id/comments", authorize("admin"), addComment);

module.exports = router;
