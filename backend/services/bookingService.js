import Booking from '../models/Booking.js';
import Room from '../models/Room.js';

const getVisibleRoomFilter = async user => {
  if (!user || user.isAdmin === true) return {};
  const privilegedRoomNames = await Room.distinct('name', {
    hasPrivilegeToBookAWeekPrior: true
  });
  return privilegedRoomNames.length
    ? { roomName: { $nin: privilegedRoomNames } }
    : {};
};

export const getBookingsForDay = async (dayOffset = 0, user) => {
  const start = new Date();
  start.setDate(start.getDate() + dayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  const roomFilter = await getVisibleRoomFilter(user);
  return Booking.find({
    ...roomFilter,
    status: 'confirmed',
    startTime: { $gte: start, $lte: end }
  }).sort({ startTime: 1 });
};

export const getTodayBookings = () => getBookingsForDay(0);

export const findOverlappingBooking = (roomName, startTime, endTime) => Booking.findOne({
  roomName, status: 'confirmed', startTime: { $lt: endTime }, endTime: { $gt: startTime }
});

export const createBooking = (details, user) => Booking.create({
  ...details, status: 'confirmed',
  bookedById: user?.id || null, bookedByEmail: user?.email || null, bookedByName: user?.name || null
});

export const getBookingById = id => Booking.findById(id);

export const getBookingHistory = async ({ mode, scope, userEmail, userId, page, limit, user }) => {
  const query = await getVisibleRoomFilter(user);
  const normalizedEmail = userEmail?.toLowerCase();
  const escapedEmail = normalizedEmail?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const emailCondition = escapedEmail
    ? { $regex: `^${escapedEmail}$`, $options: 'i' }
    : null;

  if (scope === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    query.startTime = { $gte: start, $lte: end };
  } else if (scope === 'future') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    query.startTime = { $gte: tomorrow };
  }

  if (mode === 'bookedBy') {
    query.$or = [
      ...(userId ? [{ bookedById: userId }] : []),
      ...(emailCondition ? [{ bookedByEmail: emailCondition }] : [])
    ];
  } else if (mode === 'included') {
    query.$or = [
      ...(userId ? [{ bookedById: userId }] : []),
      ...(emailCondition ? [
        { bookedByEmail: emailCondition },
        { teammates: { $elemMatch: emailCondition } }
      ] : [])
    ];
  }

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .sort({ startTime: scope === 'all' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Booking.countDocuments(query)
  ]);

  return {
    bookings: bookings.map(booking => {
      const attendees = [booking.bookedByEmail || booking.bookedByName, ...(booking.teammates || [])]
        .filter(Boolean)
        .filter((email, index, list) => list.findIndex(item => item.toLowerCase() === email.toLowerCase()) === index);
      return {
        id: booking._id,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        roomName: booking.roomName,
        organizer: {
          id: booking.bookedById,
          name: booking.bookedByName,
          email: booking.bookedByEmail
        },
        peopleCount: booking.peopleCount,
        attendees,
        status: booking.status,
        canCancel: booking.status !== 'cancelled' && Boolean(
          (booking.bookedById && booking.bookedById === user?.id) ||
          (booking.bookedByEmail && user?.email && booking.bookedByEmail.toLowerCase() === user.email.toLowerCase())
        )
      };
    }),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

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
