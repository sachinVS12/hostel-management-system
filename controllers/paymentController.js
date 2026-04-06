const Payment = require("../models/Payment");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Room = require("../models/Room");

// @desc    Create new payment
// @route   POST /api/payments
exports.createPayment = async (req, res) => {
  try {
    const { amount, paymentType, paymentMethod, transactionId, bookingId } =
      req.body;

    // Generate receipt number
    const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const paymentData = {
      student: req.user.id,
      amount,
      paymentType,
      paymentMethod,
      transactionId,
      receiptNumber,
      status: "success", // Auto-success for demo, integrate with payment gateway
    };

    // If payment is for a booking
    if (bookingId) {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }
      paymentData.booking = bookingId;

      // Update booking paid amount
      booking.paidAmount = (booking.paidAmount || 0) + amount;
      if (booking.paidAmount >= booking.totalAmount) {
        booking.paymentStatus = "paid";
      } else if (booking.paidAmount > 0) {
        booking.paymentStatus = "partial";
      }
      await booking.save();
    }

    const payment = await Payment.create(paymentData);

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all payments (Admin only)
// @route   GET /api/payments
exports.getAllPayments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentType,
      startDate,
      endDate,
    } = req.query;

    let query = {};

    // Apply filters
    if (status) query.status = status;
    if (paymentType) query.paymentType = paymentType;

    // Date range filter
    if (startDate || endDate) {
      query.paymentDate = {};
      if (startDate) query.paymentDate.$gte = new Date(startDate);
      if (endDate) query.paymentDate.$lte = new Date(endDate);
    }

    const payments = await Payment.find(query)
      .populate("student", "name email registrationNumber phone")
      .populate("booking")
      .sort("-paymentDate")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("student", "name email registrationNumber phone")
      .populate("booking");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check authorization
    if (
      req.user.role !== "admin" &&
      payment.student._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this payment",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get my payments (Student)
// @route   GET /api/payments/my-payments
exports.getMyPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const payments = await Payment.find({ student: req.user.id })
      .populate("booking")
      .sort("-paymentDate")
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments({ student: req.user.id });

    res.status(200).json({
      success: true,
      count: payments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get payment statistics (Admin only)
// @route   GET /api/payments/stats
exports.getPaymentStats = async (req, res) => {
  try {
    // Total revenue
    const totalRevenue = await Payment.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Revenue by payment type
    const revenueByType = await Payment.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: "$paymentType", total: { $sum: "$amount" } } },
    ]);

    // Revenue by payment method
    const revenueByMethod = await Payment.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: "$paymentMethod", total: { $sum: "$amount" } } },
    ]);

    // Monthly revenue for current year
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: "success",
          paymentDate: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$paymentDate" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Today's collections
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCollections = await Payment.aggregate([
      {
        $match: {
          status: "success",
          paymentDate: { $gte: today, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Pending payments (from bookings)
    const pendingPayments = await Booking.aggregate([
      {
        $match: {
          paymentStatus: { $in: ["pending", "partial"] },
          status: "confirmed",
        },
      },
      {
        $group: {
          _id: null,
          totalPending: {
            $sum: { $subtract: ["$totalAmount", "$paidAmount"] },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0]?.total || 0,
        revenueByType: revenueByType,
        revenueByMethod: revenueByMethod,
        monthlyRevenue: monthlyRevenue,
        todayCollections: {
          total: todayCollections[0]?.total || 0,
          count: todayCollections[0]?.count || 0,
        },
        pendingPayments: pendingPayments[0]?.totalPending || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update payment status (Admin only)
// @route   PUT /api/payments/:id/status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status, transactionId } = req.body;

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    payment.status = status;
    if (transactionId) payment.transactionId = transactionId;

    await payment.save();

    // If payment is for a booking, update booking payment status
    if (payment.booking) {
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        const allPayments = await Payment.find({
          booking: payment.booking,
          status: "success",
        });
        const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

        booking.paidAmount = totalPaid;
        if (totalPaid >= booking.totalAmount) {
          booking.paymentStatus = "paid";
        } else if (totalPaid > 0) {
          booking.paymentStatus = "partial";
        } else {
          booking.paymentStatus = "pending";
        }
        await booking.save();
      }
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Generate payment receipt (PDF/HTML)
// @route   GET /api/payments/:id/receipt
exports.generateReceipt = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate("student", "name email registrationNumber phone address")
      .populate("booking");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check authorization
    if (
      req.user.role !== "admin" &&
      payment.student._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this receipt",
      });
    }

    // Generate HTML receipt
    const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Payment Receipt</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                    }
                    .receipt {
                        max-width: 800px;
                        margin: 0 auto;
                        border: 1px solid #ddd;
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #333;
                        margin-bottom: 20px;
                        padding-bottom: 10px;
                    }
                    .title {
                        font-size: 24px;
                        font-weight: bold;
                    }
                    .subtitle {
                        color: #666;
                        margin-top: 5px;
                    }
                    .receipt-info {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                        padding: 10px;
                        background: #f5f5f5;
                    }
                    .student-info, .payment-info {
                        margin-bottom: 20px;
                    }
                    .info-row {
                        margin-bottom: 10px;
                    }
                    .label {
                        font-weight: bold;
                        display: inline-block;
                        width: 150px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    th, td {
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                    .total {
                        text-align: right;
                        font-size: 18px;
                        font-weight: bold;
                        margin-top: 20px;
                        padding-top: 10px;
                        border-top: 2px solid #333;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 30px;
                        padding-top: 10px;
                        border-top: 1px solid #ddd;
                        font-size: 12px;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <div class="title">HOSTEL MANAGEMENT SYSTEM</div>
                        <div class="subtitle">Payment Receipt</div>
                    </div>
                    
                    <div class="receipt-info">
                        <div>
                            <strong>Receipt No:</strong> ${payment.receiptNumber}<br>
                            <strong>Date:</strong> ${new Date(payment.paymentDate).toLocaleString()}
                        </div>
                        <div>
                            <strong>Payment Status:</strong> ${payment.status.toUpperCase()}<br>
                            <strong>Transaction ID:</strong> ${payment.transactionId || "N/A"}
                        </div>
                    </div>
                    
                    <div class="student-info">
                        <h3>Student Information</h3>
                        <div class="info-row">
                            <span class="label">Name:</span> ${payment.student.name}
                        </div>
                        <div class="info-row">
                            <span class="label">Registration No:</span> ${payment.student.registrationNumber || "N/A"}
                        </div>
                        <div class="info-row">
                            <span class="label">Email:</span> ${payment.student.email}
                        </div>
                        <div class="info-row">
                            <span class="label">Phone:</span> ${payment.student.phone}
                        </div>
                    </div>
                    
                    <div class="payment-info">
                        <h3>Payment Details</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${payment.paymentType.toUpperCase()} Fee</td>
                                    <td>₹${payment.amount.toFixed(2)}</td>
                                </tr>
                                ${
                                  payment.booking && payment.booking.room
                                    ? `
                                <tr>
                                    <td>Room No: ${payment.booking.room.roomNumber}</td>
                                    <td>-</td>
                                </tr>
                                `
                                    : ""
                                }
                            </tbody>
                        </table>
                        <div class="total">
                            Total Amount: ₹${payment.amount.toFixed(2)}
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>This is a computer-generated receipt and does not require a signature.</p>
                        <p>Thank you for your payment!</p>
                    </div>
                </div>
            </body>
            </html>
        `;

    res.setHeader("Content-Type", "text/html");
    res.send(receiptHtml);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get payment by receipt number
// @route   GET /api/payments/receipt/:receiptNumber
exports.getPaymentByReceipt = async (req, res) => {
  try {
    const payment = await Payment.findOne({
      receiptNumber: req.params.receiptNumber,
    })
      .populate("student", "name email registrationNumber phone")
      .populate("booking");

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check authorization
    if (
      req.user.role !== "admin" &&
      payment.student._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this payment",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get payment summary for student dashboard
// @route   GET /api/payments/summary
exports.getPaymentSummary = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Total paid
    const totalPaid = await Payment.aggregate([
      { $match: { student: studentId, status: "success" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Last 6 months payments
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentPayments = await Payment.find({
      student: studentId,
      status: "success",
      paymentDate: { $gte: sixMonthsAgo },
    }).sort("-paymentDate");

    // Payment by type
    const paymentsByType = await Payment.aggregate([
      { $match: { student: studentId, status: "success" } },
      { $group: { _id: "$paymentType", total: { $sum: "$amount" } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPaid: totalPaid[0]?.total || 0,
        recentPayments: recentPayments,
        paymentsByType: paymentsByType,
        totalTransactions: recentPayments.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Initiate payment (for payment gateway integration)
// @route   POST /api/payments/initiate
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, paymentType, bookingId, paymentMethod } = req.body;

    // Create payment record with pending status
    const receiptNumber = `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const payment = await Payment.create({
      student: req.user.id,
      amount,
      paymentType,
      paymentMethod,
      booking: bookingId || null,
      receiptNumber,
      status: "pending",
    });

    // Here you would integrate with payment gateway like Razorpay, Stripe, etc.
    // For demo purposes, we'll return a mock payment link

    res.status(200).json({
      success: true,
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        receiptNumber: payment.receiptNumber,
        paymentLink: `https://paymentgateway.com/pay/${payment._id}`, // Mock link
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PAY${payment._id}`, // Mock QR
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Verify payment (webhook from payment gateway)
// @route   POST /api/payments/verify
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId, transactionId, status } = req.body;

    const payment = await Payment.findById(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    payment.status = status === "success" ? "success" : "failed";
    if (transactionId) payment.transactionId = transactionId;

    await payment.save();

    // If payment is successful and has booking, update booking
    if (payment.status === "success" && payment.booking) {
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        booking.paidAmount = (booking.paidAmount || 0) + payment.amount;
        if (booking.paidAmount >= booking.totalAmount) {
          booking.paymentStatus = "paid";
        } else if (booking.paidAmount > 0) {
          booking.paymentStatus = "partial";
        }
        await booking.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      data: payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete payment (Admin only)
// @route   DELETE /api/payments/:id
exports.deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    await payment.remove();

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Export payments to CSV (Admin only)
// @route   GET /api/payments/export/csv
exports.exportPaymentsCSV = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate("student", "name email registrationNumber")
      .sort("-paymentDate");

    // Create CSV header
    let csv =
      "Receipt No,Student Name,Registration No,Email,Amount,Payment Type,Payment Method,Status,Transaction ID,Date\n";

    // Add rows
    payments.forEach((payment) => {
      csv += `"${payment.receiptNumber}","${payment.student.name}","${payment.student.registrationNumber || "N/A"}","${payment.student.email}","${payment.amount}","${payment.paymentType}","${payment.paymentMethod}","${payment.status}","${payment.transactionId || "N/A"}","${new Date(payment.paymentDate).toLocaleString()}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=payments.csv");
    res.send(csv);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
