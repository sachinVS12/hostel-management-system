const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const {
  getAllRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  getAvailableRooms,
} = require("../controllers/roomController");

// Public routes (authenticated users)
router.use(protect);
router.get("/", getAllRooms);
router.get("/available", getAvailableRooms);
router.get("/:id", getRoomById);

// Admin only routes
router.post("/", authorize("admin"), createRoom);
router.put("/:id", authorize("admin"), updateRoom);
router.delete("/:id", authorize("admin"), deleteRoom);

module.exports = router;
