import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Exchange Online room mailbox email — provided by IT after Azure setup
  // e.g. "nova.fdgdc5@yourcompany.com"
  // Leave null until IT provides real values.
  outlookEmail: {
    type: String,
    trim: true,
    default: null
  },
  location: {
    type: String,
    required: true,
    trim: true
  },
  floor: {
    type: String,
    required: true,
    trim: true
  },
  roomType: {
    type: String,
    required: true,
    enum: ['Conference Room', 'Discussion Room', 'Training Room', 'Board Room']
  },
  sittingCapacity: {
    type: Number,
    required: true,
    min: 1
  },
  tvAvailability: {
    type: Boolean,
    required: true,
    default: false
  },
  minBookingHours: {
    type: Number,
    required: true,
    default: 0.5 // 30 minutes
  },
  maxBookingHours: {
    type: Number,
    required: true,
    default: 2
  },
  authorizedRoles: {
    type: [String],
    required: true,
    default: ['Everyone']
    // e.g. ['Everyone'] or ['IT', 'Admin', 'HR', 'L&D']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for quick lookup by capacity and type
roomSchema.index({ sittingCapacity: 1, roomType: 1 });

const Room = mongoose.model('Room', roomSchema);

export default Room;
