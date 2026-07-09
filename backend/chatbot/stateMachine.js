import Booking from '../models/Booking.js';
import { parseMessage, timeStringToDate } from './parser.js';

export const ROOMS = [
  { name: 'Zenith', capacity: 4, description: 'Cozy space for small teams' },
  { name: 'Quantum', capacity: 8, description: 'Tech-equipped collaboration room' },
  { name: 'Apex', capacity: 12, description: 'Executive boardroom' },
  { name: 'Nova', capacity: 20, description: 'Large presentation auditorium' }
];

export const detectNonTodayDates = (text) => {
  const lowercase = text.toLowerCase();
  
  if (lowercase.includes('tomorrow') || lowercase.includes('yesterday') || lowercase.includes('next week')) {
    return true;
  }
  
  const days = ['monday', 'tuesday', 'wednesday', 'friday', 'saturday', 'sunday'];
  for (const day of days) {
    if (lowercase.match(new RegExp(`\\b${day}\\b`, 'i'))) {
      return true;
    }
  }
  
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  for (const month of months) {
    const monthRegex = new RegExp(`\\b${month}\\s+(\\d{1,2})\\b|\\b(\\d{1,2})\\s+${month}\\b`, 'i');
    const match = lowercase.match(monthRegex);
    if (match) {
      const dayNum = parseInt(match[1] || match[2], 10);
      // Today is July 9, 2026. If the message matches "July 9" or "9 July", we allow it. Otherwise reject.
      const isJuly = month.startsWith('jul');
      if (isJuly && dayNum === 9) {
        continue;
      }
      return true;
    }
  }
  
  const dateRegex = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/;
  const dateMatch = lowercase.match(dateRegex);
  if (dateMatch) {
    try {
      const parsedDate = new Date(dateMatch[0]);
      if (!isNaN(parsedDate.getTime())) {
        const today = new Date();
        if (parsedDate.getFullYear() !== today.getFullYear() ||
            parsedDate.getMonth() !== today.getMonth() ||
            parsedDate.getDate() !== today.getDate()) {
          return true;
        }
      }
    } catch (e) {
      // Ignore parse failure and fall through
    }
  }
  
  return false;
};

const formatTime = (date) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const handleChat = async (userMessage, session) => {
  const currentStep = session.step || 'AWAITING_BOOKING_INIT';
  const bookingData = session.bookingData || {
    roomName: null,
    peopleCount: null,
    durationHours: null,
    startTimeStr: null
  };

  // Create copy of state to return
  const nextSession = {
    step: currentStep,
    bookingData: { ...bookingData }
  };

  const parsed = parseMessage(userMessage);

  // Global commands
  if (parsed.intent === 'cancel' || userMessage.toLowerCase() === 'reset' || userMessage.toLowerCase() === 'restart') {
    nextSession.step = 'AWAITING_BOOKING_INIT';
    nextSession.bookingData = { roomName: null, peopleCount: null, durationHours: null, startTimeStr: null };
    return {
      reply: 'Booking process cancelled. Let me know if you would like to start a new booking!',
      session: nextSession
    };
  }

  // 1. Check Date Constraint: Reject bookings for yesterday/tomorrow/future
  if (detectNonTodayDates(userMessage)) {
    return {
      reply: '⚠️ **Date Restriction**: I can only book rooms for **TODAY** (July 9, 2026). Bookings for yesterday, tomorrow, or any future dates are not allowed. Please enter a time slot for today.',
      session: nextSession
    };
  }

  // 2. State Machine Flow logic
  if (currentStep === 'AWAITING_BOOKING_INIT') {
    // Check if user is trying to book
    if (parsed.intent === 'book' || parsed.roomName || parsed.peopleCount || parsed.durationHours || parsed.startTimeStr) {
      nextSession.step = 'COLLECTING_INFO';
    } else {
      return {
        reply: '👋 Hello! I am your Meeting Room Booking Chatbot. I can book rooms for **today only**. \n\nTo get started, you can tell me what you need, like: *"Book a room for 5 people at 3 PM for 2 hours."* or simply say *"Book a room"*!',
        session: nextSession
      };
    }
  }

  // If in a collection state, merge parsed info
  const isCollecting = [
    'COLLECTING_INFO', 
    'AWAITING_PEOPLE', 
    'AWAITING_ROOM', 
    'AWAITING_START_TIME', 
    'AWAITING_DURATION'
  ].includes(nextSession.step);

  if (isCollecting) {
    // Merge parsed variables if present
    if (parsed.roomName !== undefined) nextSession.bookingData.roomName = parsed.roomName;
    if (parsed.peopleCount !== undefined) nextSession.bookingData.peopleCount = parsed.peopleCount;
    if (parsed.durationHours !== undefined) nextSession.bookingData.durationHours = parsed.durationHours;
    if (parsed.startTimeStr !== undefined) nextSession.bookingData.startTimeStr = parsed.startTimeStr;

    // Check if we just received a raw input based on what we asked for previously
    if (currentStep === 'AWAITING_PEOPLE' && !parsed.peopleCount) {
      const matchNum = userMessage.match(/\b\d+\b/);
      if (matchNum) nextSession.bookingData.peopleCount = parseInt(matchNum[0], 10);
    } else if (currentStep === 'AWAITING_DURATION' && !parsed.durationHours) {
      const matchNum = userMessage.match(/\b(\d+(?:\.\d+)?)\b/);
      if (matchNum) nextSession.bookingData.durationHours = parseFloat(matchNum[0]);
    } else if (currentStep === 'AWAITING_ROOM' && !parsed.roomName) {
      const matchRoom = userMessage.match(/\b(zenith|quantum|apex|nova)\b/i);
      if (matchRoom) nextSession.bookingData.roomName = matchRoom[1].charAt(0).toUpperCase() + matchRoom[1].slice(1).toLowerCase();
    } else if (currentStep === 'AWAITING_START_TIME' && !parsed.startTimeStr) {
      // Try to parse raw time, e.g. "3", "14:30" or "at 3"
      const rawParsed = parseMessage(userMessage);
      if (rawParsed.startTimeStr) {
        nextSession.bookingData.startTimeStr = rawParsed.startTimeStr;
      } else {
        const numMatch = userMessage.match(/\b(1[0-2]|[1-9]|1[3-9]|2[0-3])\b/);
        if (numMatch) {
          let hour = parseInt(numMatch[1], 10);
          if (hour >= 1 && hour <= 7) hour += 12; // Default to PM for working hours 1-7
          nextSession.bookingData.startTimeStr = `${hour.toString().padStart(2, '0')}:00`;
        }
      }
    }

    // Now validate existing data fields
    // Validate People Count
    if (nextSession.bookingData.peopleCount !== null) {
      if (nextSession.bookingData.peopleCount <= 0) {
        nextSession.bookingData.peopleCount = null;
        return {
          reply: '⚠️ The number of people must be at least 1. How many people will attend?',
          session: nextSession
        };
      }
      if (nextSession.bookingData.peopleCount > 20) {
        nextSession.bookingData.peopleCount = null;
        return {
          reply: '⚠️ We do not have meeting rooms that can accommodate more than 20 people. What is your actual team size?',
          session: nextSession
        };
      }
    }

    // Validate Room Capacity (if both room and capacity are known)
    if (nextSession.bookingData.roomName && nextSession.bookingData.peopleCount) {
      const selectedRoom = ROOMS.find(r => r.name.toLowerCase() === nextSession.bookingData.roomName.toLowerCase());
      if (selectedRoom && nextSession.bookingData.peopleCount > selectedRoom.capacity) {
        const fittingRooms = ROOMS.filter(r => r.capacity >= nextSession.bookingData.peopleCount);
        const replyMsg = `⚠️ **Capacity Warning**: The **${selectedRoom.name}** room has a maximum capacity of **${selectedRoom.capacity} people**. \n\nFor **${nextSession.bookingData.peopleCount} people**, please choose: ${fittingRooms.map(r => `**${r.name}** (max ${r.capacity})`).join(', ')}. \n\nWhich room would you like instead?`;
        nextSession.bookingData.roomName = null; // Reset room selection
        nextSession.step = 'AWAITING_ROOM';
        return {
          reply: replyMsg,
          session: nextSession
        };
      }
    }

    // Validate Duration
    if (nextSession.bookingData.durationHours !== null) {
      const dur = nextSession.bookingData.durationHours;
      if (dur < 1 || dur > 6) {
        nextSession.bookingData.durationHours = null;
        return {
          reply: '⚠️ **Duration Constraint**: Meeting duration must be between **1 hour** and **6 hours**. \n\nHow many hours do you need the room for?',
          session: nextSession
        };
      }
    }

    // Validate Start Time & end time overlap/today-only
    if (nextSession.bookingData.startTimeStr !== null) {
      const startDateTime = timeStringToDate(nextSession.bookingData.startTimeStr);
      if (!startDateTime || isNaN(startDateTime.getTime())) {
        nextSession.bookingData.startTimeStr = null;
        return {
          reply: '⚠️ Please provide a valid start time for today (e.g., "3:00 PM" or "14:30"). What time should the meeting start?',
          session: nextSession
        };
      }

      // Check if start time is in the past (only if current day is today)
      // Since it's for today, let's compare with current system time
      const now = new Date();
      // Wait, let's normalize check to verify it is for today
      if (startDateTime.getTime() < now.getTime() - 5 * 60 * 1000) { // Allow 5 mins buffer
        nextSession.bookingData.startTimeStr = null;
        return {
          reply: `⚠️ The start time you selected (**${formatTime(startDateTime)}**) is in the past. Please select a future time today.`,
          session: nextSession
        };
      }

      // If duration is also known, check if end time overflows today (midnight)
      if (nextSession.bookingData.durationHours !== null) {
        const endDateTime = new Date(startDateTime.getTime() + nextSession.bookingData.durationHours * 60 * 60 * 1000);
        const midnight = new Date();
        midnight.setHours(23, 59, 59, 999);
        
        if (endDateTime.getTime() > midnight.getTime()) {
          nextSession.bookingData.startTimeStr = null;
          return {
            reply: `⚠️ **Date Constraint**: The booking must start and end **today**. A duration of **${nextSession.bookingData.durationHours} hours** starting at **${formatTime(startDateTime)}** would end tomorrow. \n\nPlease choose an earlier start time or a shorter duration.`,
            session: nextSession
          };
        }
      }
    }

    // Ask for missing details sequentially
    // Step 2a: Ask for People count if not specified
    if (nextSession.bookingData.peopleCount === null) {
      nextSession.step = 'AWAITING_PEOPLE';
      return {
        reply: '👥 How many people will be attending the meeting?',
        session: nextSession
      };
    }

    // Step 2b: Ask for Room if not specified (or filter based on capacity)
    if (nextSession.bookingData.roomName === null) {
      const fittingRooms = ROOMS.filter(r => r.capacity >= nextSession.bookingData.peopleCount);
      nextSession.step = 'AWAITING_ROOM';
      return {
        reply: `🏢 For **${nextSession.bookingData.peopleCount} people**, which room would you like to book?\n\nAvailable options:\n${fittingRooms.map(r => `- **${r.name}** (Capacity: ${r.capacity} | *${r.description}*)`).join('\n')}`,
        session: nextSession
      };
    }

    // Step 2c: Ask for Start Time if not specified
    if (nextSession.bookingData.startTimeStr === null) {
      nextSession.step = 'AWAITING_START_TIME';
      return {
        reply: '⏰ What time should the meeting start today? (e.g., "2:30 PM" or "14:00")',
        session: nextSession
      };
    }

    // Step 2d: Ask for Duration if not specified
    if (nextSession.bookingData.durationHours === null) {
      nextSession.step = 'AWAITING_DURATION';
      return {
        reply: '⏳ What is the duration of the meeting in hours? (Min: 1 hour, Max: 6 hours)',
        session: nextSession
      };
    }

    // If we have all information, double check double-booking before proceeding
    const startDateTime = timeStringToDate(nextSession.bookingData.startTimeStr);
    const endDateTime = new Date(startDateTime.getTime() + nextSession.bookingData.durationHours * 60 * 60 * 1000);

    // Double-booking check
    const overlappingBooking = await Booking.findOne({
      roomName: nextSession.bookingData.roomName,
      status: 'confirmed',
      startTime: { $lt: endDateTime },
      endTime: { $gt: startDateTime }
    });

    if (overlappingBooking) {
      // Conflict! Ask user to change time or room
      nextSession.bookingData.startTimeStr = null; // Reset start time
      nextSession.step = 'AWAITING_START_TIME';
      return {
        reply: `❌ **Double-Booking Conflict**: The **${nextSession.bookingData.roomName}** room is already booked between **${formatTime(overlappingBooking.startTime)}** and **${formatTime(overlappingBooking.endTime)}** today. \n\nPlease choose a different start time for today.`,
        session: nextSession
      };
    }

    // All checks pass! Go to confirmation step
    nextSession.step = 'AWAITING_CONFIRMATION';
    return {
      reply: `Please review your booking details.`,
      session: nextSession,
      showConfirmation: true
    };
  }

  // Handle confirmation input
  if (currentStep === 'AWAITING_CONFIRMATION') {
    if (parsed.intent === 'confirm' || userMessage.toLowerCase() === 'confirm') {
      // Finalize booking in database
      const startDateTime = timeStringToDate(bookingData.startTimeStr);
      const endDateTime = new Date(startDateTime.getTime() + bookingData.durationHours * 60 * 60 * 1000);
      
      // Double check one last time for safety
      const overlappingBooking = await Booking.findOne({
        roomName: bookingData.roomName,
        status: 'confirmed',
        startTime: { $lt: endDateTime },
        endTime: { $gt: startDateTime }
      });

      if (overlappingBooking) {
        nextSession.bookingData.startTimeStr = null;
        nextSession.step = 'AWAITING_START_TIME';
        return {
          reply: `❌ **Double-Booking Conflict**: Someone just booked **${bookingData.roomName}** from **${formatTime(overlappingBooking.startTime)}** to **${formatTime(overlappingBooking.endTime)}**. Please select a new start time.`,
          session: nextSession
        };
      }

      const newBooking = new Booking({
        roomName: bookingData.roomName,
        peopleCount: bookingData.peopleCount,
        startTime: startDateTime,
        endTime: endDateTime,
        date: new Date(new Date().setHours(0, 0, 0, 0)),
        status: 'confirmed'
      });

      await newBooking.save();

      nextSession.step = 'AWAITING_BOOKING_INIT';
      nextSession.bookingData = { roomName: null, peopleCount: null, durationHours: null, startTimeStr: null };

      return {
        reply: `🎉 **Success!** Your booking for the **${bookingData.roomName}** room has been confirmed.\n\n📅 **Date**: Today, July 9, 2026\n⏰ **Time**: ${formatTime(startDateTime)} - ${formatTime(endDateTime)} (${bookingData.durationHours} hours)\n👥 **Attendees**: ${bookingData.peopleCount} people`,
        session: nextSession,
        bookingConfirmed: true
      };
    } else if (parsed.intent === 'cancel' || userMessage.toLowerCase() === 'cancel' || parsed.intent === 'reject') {
      nextSession.step = 'AWAITING_BOOKING_INIT';
      nextSession.bookingData = { roomName: null, peopleCount: null, durationHours: null, startTimeStr: null };
      return {
        reply: 'Booking cancelled. How else can I help you today?',
        session: nextSession
      };
    } else {
      return {
        reply: '❓ Please click **Confirm** or **Cancel** on the booking card, or type "confirm" / "cancel" to proceed.',
        session: nextSession,
        showConfirmation: true
      };
    }
  }

  // Fallback
  return {
    reply: 'I did not quite understand that. Would you like to book a meeting room?',
    session: nextSession
  };
};
