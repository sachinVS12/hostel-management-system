const User = require("../models/User");
const Room = require("../models/Room");
//const Booking = require("../models/Booking");
//const Complaint = require("../models/Complaint");
//const Payment = require("../models/Payment");

// @desc    Get all students
// @route   GET /api/admin/students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await User.find({ role: "student" }).select("-password");
    res.status(200).json({
      success: true,
      count: students.length,
      data: students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get student by ID
// @route   GET /api/admin/students/:id
exports.getStudentById = async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select("-password");

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Get student's booking details
    const booking = await Booking.findOne({ student: req.params.id })
      .populate("room")
      .sort("-createdAt");

    // Get student's complaints
    const complaints = await Complaint.find({ student: req.params.id }).sort(
      "-createdAt",
    );

    // Get student's payments
    const payments = await Payment.find({ student: req.params.id }).sort(
      "-paymentDate",
    );

    res.status(200).json({
      success: true,
      data: {
        student,
        booking,
        complaints,
        payments,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update student
// @route   PUT /api/admin/students/:id
exports.updateStudent = async (req, res) => {
  try {
    let student = await User.findById(req.params.id);

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    student = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select("-password");

    res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete student
// @route   DELETE /api/admin/students/:id
exports.deleteStudent = async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Delete all associated data
    await Booking.deleteMany({ student: req.params.id });
    await Complaint.deleteMany({ student: req.params.id });
    await Payment.deleteMany({ student: req.params.id });
    await student.remove();

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalRooms = await Room.countDocuments();
    const occupiedRooms = await Room.countDocuments({ status: "occupied" });
    const availableRooms = await Room.countDocuments({ status: "available" });
    const pendingComplaints = await Complaint.countDocuments({
      status: "pending",
    });
    const totalRevenue = await Payment.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const recentBookings = await Booking.find()
      .populate("student", "name email")
      .populate("room", "roomNumber")
      .sort("-createdAt")
      .limit(5);

    const recentComplaints = await Complaint.find()
      .populate("student", "name")
      .sort("-createdAt")
      .limit(5);

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalRooms,
        occupiedRooms,
        availableRooms,
        pendingComplaints,
        totalRevenue: totalRevenue[0]?.total || 0,
        recentBookings,
        recentComplaints,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
