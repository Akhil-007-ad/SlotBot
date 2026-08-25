import Booking from '../models/Booking.js';

export const getTodayBookings = () => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  return Booking.find({ status: 'confirmed', startTime: { $gte: start, $lte: end } }).sort({ startTime: 1 });
};

export const findOverlappingBooking = (roomName, startTime, endTime) => Booking.findOne({
  roomName, status: 'confirmed', startTime: { $lt: endTime }, endTime: { $gt: startTime }
});

export const createBooking = (details, user) => Booking.create({
  ...details, status: 'confirmed',
  bookedById: user?.id || null, bookedByEmail: user?.email || null, bookedByName: user?.name || null
});

export const getBookingById = id => Booking.findById(id);

// ─── Local Database Teammate Availability Check ──────────────────────────────
export const checkDbTeammateAvailability = async (emails, startTime, endTime) => {
  // Query all overlapping bookings for today
  const overlappingBookings = await Booking.find({
    status: 'confirmed',
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  });

  const busyEmails = [];
  for (const booking of overlappingBookings) {
    if (booking.bookedByEmail && emails.includes(booking.bookedByEmail)) {
      busyEmails.push(booking.bookedByEmail);
    }
    if (booking.teammates && Array.isArray(booking.teammates)) {
      for (const tEmail of booking.teammates) {
        if (emails.includes(tEmail)) {
          busyEmails.push(tEmail);
        }
      }
    }
  }

  // Also check static mock schedules for local development testing
  const mockSchedules = {
    'shaik@techwave.com': [
      { start: '14:00', end: '15:30', reason: 'Sprint Planning' }
    ],
    'akhil@techwave.com': [
      { start: '11:00', end: '12:30', reason: 'Client Demo' }
    ],
    'anirudh@techwave.com': [
      { start: '15:00', end: '16:00', reason: 'Sync Meeting' }
    ]
  };

  const getTodayTime = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  for (const email of emails) {
    const list = mockSchedules[email] || [];
    for (const sched of list) {
      const schedStart = getTodayTime(sched.start);
      const schedEnd = getTodayTime(sched.end);
      if (schedStart < endTime && schedEnd > startTime) {
        if (!busyEmails.includes(email)) {
          busyEmails.push(email);
        }
      }
    }
  }

  return [...new Set(busyEmails)];
};

// ─── Find First Free Slot locally ────────────────────────────────────────────
export const findFirstFreeSlotLocal = async (emails, roomName, durationHours) => {
  const now = new Date();
  const startSearch = new Date(now);
  const mins = startSearch.getMinutes();
  if (mins > 0 && mins <= 30) {
    startSearch.setMinutes(30, 0, 0);
  } else if (mins > 30) {
    startSearch.setHours(startSearch.getHours() + 1, 0, 0, 0);
  } else {
    startSearch.setMinutes(0, 0, 0);
  }

  const midnight = new Date();
  midnight.setHours(23, 59, 0, 0);

  let currentStart = new Date(startSearch);
  const durMs = durationHours * 60 * 60 * 1000;

  while (currentStart.getTime() + durMs <= midnight.getTime()) {
    const currentEnd = new Date(currentStart.getTime() + durMs);

    // Check room overlap
    const roomOverlap = await findOverlappingBooking(roomName, currentStart, currentEnd);
    if (!roomOverlap) {
      // Check teammate overlap
      const busyTeammates = await checkDbTeammateAvailability(emails, currentStart, currentEnd);
      if (busyTeammates.length === 0) {
        const hStr = currentStart.getHours().toString().padStart(2, '0');
        const mStr = currentStart.getMinutes().toString().padStart(2, '0');
        return `${hStr}:${mStr}`;
      }
    }

    currentStart.setMinutes(currentStart.getMinutes() + 30);
  }

  return null;
};
