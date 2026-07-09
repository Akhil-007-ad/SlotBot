import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  roomName: {
    type: String,
    required: true,
    trim: true,
    enum: ['Zenith', 'Quantum', 'Apex', 'Nova']
  },
  peopleCount: {
    type: Number,
    required: true,
    min: 1
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  date: {
    type: Date, // normalized date (midnight of today)
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed'
  }
}, {
  timestamps: true
});

// Compound index for overlapping checks
bookingSchema.index({ roomName: 1, status: 1, startTime: 1, endTime: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
