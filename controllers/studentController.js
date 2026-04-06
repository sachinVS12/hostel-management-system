const Booking = require("../models/Booking");
const Complaint = require("../models/Complaint");
const Payment = require("../models/Payment");
//const Room = require("../models/Room");

// @desc    Get student dashboard data
// @route   GET /api/student/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get current booking
    const currentBooking = await Booking.findOne({
      student: studentId,
      status: { $in: ["confirmed", "pending"] },
    }).populate("room");

    // Get complaints
    const complaints = await Complaint.find({ student: studentId })
      .sort("-createdAt")
      .limit(5);

    // Get payment history
    const payments = await Payment.find({ student: studentId })
      .sort("-paymentDate")
      .limit(5);

    // Get payment summary
    const paymentSummary = await Payment.aggregate([
      { $match: { student: studentId, status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        currentBooking,
        complaints,
        payments,
        totalPaid: paymentSummary[0]?.total || 0,
        recentActivities: [
          ...complaints.slice(0, 3),
          ...payments.slice(0, 3),
        ].sort((a, b) => b.createdAt - a.createdAt),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Book a room
// @route   POST /api/student/book-room
exports.bookRoom = async (req, res) => {
  try {
    const { roomId, checkInDate } = req.body;
    const studentId = req.user.id;

    // Check if student already has a booking
    const existingBooking = await Booking.findOne({
      student: studentId,
      status: { $in: ["pending", "confirmed"] },
    });

    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending or confirmed booking",
      });
    }

    // Check if room exists and is available
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    if (room.status !== "available" || room.currentOccupancy >= room.capacity) {
      return res.status(400).json({
        success: false,
        message: "Room is not available",
      });
    }

    // Create booking
    const booking = await Booking.create({
      student: studentId,
      room: roomId,
      checkInDate: new Date(checkInDate),
      totalAmount: room.rent,
      status: "pending",
    });

    res.status(201).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get student's complaints
// @route   GET /api/student/complaints
exports.getComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ student: req.user.id }).sort(
      "-createdAt",
    );

    res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create complaint
// @route   POST /api/student/complaints
exports.createComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.create({
      ...req.body,
      student: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: complaint,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get payment history
// @route   GET /api/student/payments
exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ student: req.user.id }).sort(
      "-paymentDate",
    );

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
