const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  createPayment,
  getAllPayments,
  getPaymentById,
  getMyPayments,
  getPaymentStats,
  updatePaymentStatus,
  generateReceipt,
  getPaymentByReceipt,
  getPaymentSummary,
  initiatePayment,
  verifyPayment,
  deletePayment,
  exportPaymentsCSV,
} = require("../controllers/paymentController");

// All routes require authentication
router.use(protect);

// Student routes
router.get("/my-payments", getMyPayments);
router.get("/summary", getPaymentSummary);
router.post("/initiate", initiatePayment);
router.post("/verify", verifyPayment);
router.post("/", createPayment);
router.get("/receipt/:receiptNumber", getPaymentByReceipt);
router.get("/:id/receipt", generateReceipt);
router.get("/:id", getPaymentById);

// Admin only routes
router.get("/", authorize("admin"), getAllPayments);
router.get("/stats", authorize("admin"), getPaymentStats);
router.get("/export/csv", authorize("admin"), exportPaymentsCSV);
router.put("/:id/status", authorize("admin"), updatePaymentStatus);
router.delete("/:id", authorize("admin"), deletePayment);

module.exports = router;
