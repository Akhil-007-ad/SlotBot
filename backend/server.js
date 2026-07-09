import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { connectDB } from './db.js';
import { handleChat } from './chatbot/stateMachine.js';
import Booking from './models/Booking.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for simplicity in local dev
  credentials: true
}));
app.use(bodyParser.json());

// Routes
// 1. Chatbot Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, session } = req.body;
    if (typeof message !== 'string') {
      return res.status(400).json({ error: 'Message must be a string' });
    }

    const currentSession = session || {
      step: 'AWAITING_BOOKING_INIT',
      bookingData: {
        roomName: null,
        peopleCount: null,
        durationHours: null,
        startTimeStr: null
      }
    };

    const response = await handleChat(message, currentSession);
    res.json(response);
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Room Status/Bookings Endpoint for Dashboard
app.get('/api/bookings', async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Fetch confirmed bookings for today
    const bookings = await Booking.find({
      status: 'confirmed',
      startTime: { $gte: todayStart, $lte: todayEnd }
    }).sort({ startTime: 1 });

    res.json(bookings);
  } catch (error) {
    console.error('Bookings endpoint error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Health Check
app.get('/health', (req, res) => {
  res.send('Server is healthy');
});

// Start Server after DB Connection
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
};

startServer();
