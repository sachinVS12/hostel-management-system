const Room = require("../models/Room");
const Booking = require("../models/Booking");
const User = require("../models/User");

// @desc    Get all rooms
// @route   GET /api/rooms
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find();
    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single room
// @route   GET /api/rooms/:id
exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate(
      "occupants",
      "name email registrationNumber",
    );

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create room (Admin only)
// @route   POST /api/rooms
exports.createRoom = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update room (Admin only)
// @route   PUT /api/rooms/:id
exports.updateRoom = async (req, res) => {
  try {
    let room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    room = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete room (Admin only)
// @route   DELETE /api/rooms/:id
exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    // Check if room has any active bookings
    const activeBookings = await Booking.findOne({
      room: req.params.id,
      status: { $in: ["pending", "confirmed"] },
    });

    if (activeBookings) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete room with active bookings",
      });
    }

    await room.remove();
    res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get available rooms
// @route   GET /api/rooms/available
exports.getAvailableRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      status: "available",
      currentOccupancy: { $lt: "$capacity" },
    });

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
