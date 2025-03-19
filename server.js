const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const dotenv = require("dotenv")
const cookieParser = require("cookie-parser")
const http = require("http")
const path = require("path")
const { initializeSocket } = require("./socket")

// Load environment variables
dotenv.config()

// Import routes
const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/users")
const uploadRoutes = require("./routes/upload")
const postRoutes = require("./routes/posts")
const notificationRoutes = require("./routes/notifications")
const messageRoutes = require("./routes/messages")

// Initialize express app
const app = express()
const server = http.createServer(app)
const PORT = process.env.PORT || 5001

// Initialize socket.io
const io = initializeSocket(server)
app.set("io", io)

// Middleware
app.use(express.json({ limit: "50mb" }))
app.use(cookieParser())
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
)

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/upload", uploadRoutes)
app.use("/api/posts", postRoutes)
app.use("/api/notifications", notificationRoutes)
app.use("/api/messages", messageRoutes)

// Health check route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "Server is running" })
})

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

