const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getDashboard,
  bookRoom,
  getComplaints,
  createComplaint,
  getPayments,
} = require("../controllers/studentController");

router.use(protect);
router.use(authorize("student"));

router.get("/dashboard", getDashboard);
router.post("/book-room", bookRoom);
router.get("/complaints", getComplaints);
router.post("/complaints", createComplaint);
router.get("/payments", getPayments);

module.exports = router;
