const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  getDashboardStats,
} = require("../controllers/adminController");

router.use(protect);
router.use(authorize("admin"));

router.get("/dashboard", getDashboardStats);
router.get("/students", getAllStudents);
router.get("/students/:id", getStudentById);
router.put("/students/:id", updateStudent);
router.delete("/students/:id", deleteStudent);

module.exports = router;
