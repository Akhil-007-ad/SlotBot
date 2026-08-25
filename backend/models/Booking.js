import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  roomName: {
    type: String,
    required: true,
    trim: true
    // Validation is done at runtime against the Room collection
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
    type: Date, // normalized booking date (midnight in the application's timezone)
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed'
  },
  // ─── Microsoft 365 / Graph API fields ───────────────────────────────────────
  // Populated after successful Graph API call. Null if MS365_ENABLED=false.
  outlookEventId: {
    type: String,
    default: null  // Graph event ID — used to cancel/update the Outlook event
  },
  teamsLink: {
    type: String,
    default: null  // Teams meeting join URL returned by Graph API
  },
  bookedByEmail: {
    type: String,
    default: null  // Email of the person who made the booking (future: from login)
  },
  bookedById: {
    type: String,
    default: null
  },
  bookedByName: {
    type: String,
    default: null
  },
  teammates: {
    type: [String],
    default: []
  },
  subject: {
    type: String,
    default: null
  },
  description: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for overlapping checks
bookingSchema.index({ roomName: 1, status: 1, startTime: 1, endTime: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
