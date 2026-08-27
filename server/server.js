const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const TripSocketHandler = require('./sockets/tripSocket');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(new Error('Origin is not allowed by CORS'));
    }
  },
  credentials: true
};

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions
});

// Store io instance on app for route handlers
app.set('io', io);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const tripRoutes = require('./routes/tripRoutes');
const songRoutes = require('./routes/songRoutes');
const youtubeRoutes = require('./routes/youtubeRoutes');

app.use('/api/trips', tripRoutes);
app.use('/api/trips/:tripId/songs', songRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/youtube', youtubeRoutes);

// Error handling middleware
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Socket.IO
const tripSocketHandler = new TripSocketHandler(io);
io.on('connection', (socket) => {
  tripSocketHandler.handleConnection(socket);
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
