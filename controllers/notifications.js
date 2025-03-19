const Notification = require("../models/Notification")
const User = require("../models/User")

// @desc    Get all notifications for the current user
// @route   GET /api/notifications
// @access  Private
exports.getNotifications = async (req, res) => {
  try {
    console.log(
      `Fetching notifications for user ${req.user.id}, page ${req.query.page || 1}, limit ${req.query.limit || 20}`,
    )

    // Add pagination
    const page = Number.parseInt(req.query.page, 10) || 1
    const limit = Number.parseInt(req.query.limit, 10) || 20
    const skip = (page - 1) * limit

    // Count total notifications for debugging
    const totalCount = await Notification.countDocuments({ recipient: req.user.id })
    console.log(`Total notifications for user: ${totalCount}`)

    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "sender",
        select: "username profilePicture",
      })
      .populate({
        path: "post",
        select: "text",
      })

    console.log(`Retrieved ${notifications.length} notifications`)

    // Map the notifications to the expected format with null checks
    const formattedNotifications = notifications.map((notification) => {
      // Check if sender exists, if not provide default values
      const sender = notification.sender || {
        _id: "deleted-user",
        username: "Deleted User",
        profilePicture: "/placeholder.svg?height=50&width=50",
      }

      return {
        id: notification._id,
        type: notification.type,
        user: {
          id: sender._id || "deleted-user",
          username: sender.username || "Deleted User",
          profilePicture: sender.profilePicture || "/placeholder.svg?height=50&width=50",
        },
        content: notification.content || "",
        postId: notification.post ? notification.post._id : null,
        postText: notification.post ? notification.post.text : null,
        read: notification.read || false,
        timestamp: notification.createdAt,
      }
    })

    res.status(200).json({
      success: true,
      data: formattedNotifications,
      meta: {
        page,
        limit,
        total: totalCount,
        hasMore: skip + notifications.length < totalCount,
      },
    })
  } catch (error) {
    console.error("Error fetching notifications:", error)
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while fetching notifications",
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    })
  }
}

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      })
    }

    // Make sure notification belongs to current user
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to update this notification",
      })
    }

    notification.read = true
    await notification.save()

    res.status(200).json({
      success: true,
      data: {
        id: notification._id,
        read: notification.read,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { read: true })

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      })
    }

    // Make sure notification belongs to current user
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Not authorized to delete this notification",
      })
    }

    await notification.deleteOne()

    res.status(200).json({
      success: true,
      data: {},
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

// @desc    Get unread notification count
// @route   GET /api/notifications/count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      read: false,
    })

    res.status(200).json({
      success: true,
      data: { count },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
}

