import {
  createBooking,
  findOverlappingBooking
} from '../services/bookingService.js';
import {
  checkTeammatesAvailability,
  checkRoomAvailability,
  createRoomBookingEvent,
  isMS365Enabled
} from '../services/graphService.js';
import { getChatRooms } from '../services/roomService.js';
import {
  createBookingSession,
  emptyBookingState,
  mergeBookingState,
  getMissingSearchField
} from './bookingSession.js';
import {
  extractBookingDetails,
  toLocalDateTime,
  parseYesNo
} from './extraction.js';
import {
  STATES,
  EXPECTED_FIELDS,
  determineNextState,
  parseConflictDecision,
  parseConfirmation,
  CONFLICT_ACTIONS
} from './stateMachine.js';

export const fetchRooms = getChatRooms;

const getToday = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
};

const formatTime = value => {
  if (!value) return '';
  const date = new Date(`2000-01-01T${value}`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const roomDto = room => ({
  id: room.id || room._id?.toString() || room.name,
  name: room.name,
  capacity: room.capacity,
  hasTv: Boolean(room.tvAvailability),
  location: [room.floor, room.location].filter(Boolean).join(' · ')
});

const resetSession = () => ({
  step: STATES.COLLECTING_DETAILS,
  expectedField: EXPECTED_FIELDS.ATTENDEE_COUNT,
  bookingData: { ...emptyBookingState() }
});

const ensureTodaySession = session => {
  const nextSession = createBookingSession(session);
  const today = getToday();
  if (!nextSession.bookingData) nextSession.bookingData = emptyBookingState();
  nextSession.bookingData.date = today;
  return nextSession;
};

const normalizeMessage = value => String(value || '').trim().toLowerCase().replace(/[.!?,]/g, '').replace(/\s+/g, ' ');

const isCancelMessage = message => {
  const value = normalizeMessage(message);
  return (
    /^(cancel|cancel it|cancel this|cancel booking|restart|restart booking|reset|reset booking|start over|quit)$/.test(value) ||
    /\b(cancel booking|restart booking|don't book|do not book)\b/.test(value) ||
    /\bcancel\b/.test(value)
  );
};


const rankRooms = (rooms, attendeeCount) => {
  return [...rooms].sort((a, b) => {
    const aExcess = Number(a.capacity || 0) - attendeeCount;
    const bExcess = Number(b.capacity || 0) - attendeeCount;
    if (aExcess >= 0 && bExcess >= 0) return aExcess - bExcess;
    if (aExcess >= 0) return -1;
    if (bExcess >= 0) return 1;
    return Number(a.capacity || 0) - Number(b.capacity || 0);
  });
};

const searchRooms = async (rooms, state, findOverlap, { explain = false } = {}) => {
  const start = toLocalDateTime(state.date, state.startTime);
  const end = toLocalDateTime(state.date, state.endTime);

  if (!start || !end) {
    return explain
      ? {
        availableRooms: [],
        rejectedRooms: []
      }
      : [];
  }

  const durationHours = (end.getTime() - start.getTime()) / 36e5;

  if (durationHours <= 0) {
    return explain
      ? {
        availableRooms: [],
        rejectedRooms: []
      }
      : [];
  }

  const availableRooms = [];
  const rejectedRooms = [];

  for (const room of rooms) {

    // 1. Capacity check
    if (Number(room.capacity || 0) < Number(state.attendeeCount)) {
      rejectedRooms.push({
        room,
        reason: `Capacity is ${room.capacity}, but ${state.attendeeCount} people are required.`
      });
      continue;
    }

    // 2. TV check
    if (state.tvRequired === true && !room.tvAvailability) {
      rejectedRooms.push({
        room,
        reason: 'TV is required, but this room does not have a TV.'
      });
      continue;
    }

    // 3. Minimum booking duration
    if (
      room.minBookingHours != null &&
      durationHours < Number(room.minBookingHours)
    ) {
      rejectedRooms.push({
        room,
        reason: `Minimum booking duration is ${room.minBookingHours} hour(s).`
      });
      continue;
    }

    // 4. Maximum booking duration
    if (
      room.maxBookingHours != null &&
      durationHours > Number(room.maxBookingHours)
    ) {
      rejectedRooms.push({
        room,
        reason: `Maximum booking duration is ${room.maxBookingHours} hour(s).`
      });
      continue;
    }

    // 5. Database booking overlap
    const overlaps = await findOverlap(room.name, start, end);

    if (overlaps) {
      rejectedRooms.push({
        room,
        reason: 'The room is already booked during this time.'
      });
      continue;
    }

    availableRooms.push(room);
  }

  const rankedRooms = rankRooms(
    availableRooms,
    Number(state.attendeeCount)
  );

  if (explain) {
    return {
      availableRooms: rankedRooms,
      rejectedRooms
    };
  }

  return rankedRooms;
};

const isFutureTodayTime = (date, time) => {
  const dateTime = toLocalDateTime(date, time);
  if (!dateTime) return false;
  return dateTime.getTime() > Date.now();
};

const checkParticipantConflicts = async ({
  participants,
  startTime,
  endTime,
  accessToken,
  checkParticipantAvailability
}) => {
  if (!Array.isArray(participants) || participants.length === 0) {
    return [];
  }

  try {
    console.log('\n========== PEOPLE CALENDAR CHECK ==========');
    console.log('People being checked:', participants);
    console.log('Start:', startTime);
    console.log('End:', endTime);
    console.log('Access token exists:', !!accessToken);

    const unavailableEmails = await checkParticipantAvailability(
      participants,
      startTime,
      endTime,
      accessToken
    );

    console.log('Unavailable people:', unavailableEmails);
    console.log('============================================\n');

    return unavailableEmails.map(email => ({
      email,
      startTime,
      endTime
    }));

  } catch (error) {
    console.error(
      'Calendar availability check failed:',
      error.message
    );

    return participants.map(email => ({
      email,
      startTime,
      endTime,
      reason: 'Unable to verify calendar availability'
    }));
  }
};

const findNearestAlternative = async ({
  rooms,
  state,
  findOverlap,
  checkRoomCalendar,
  checkParticipantCalendar,
  accessToken,
  requesterEmail
}) => {
  const requestedStart = toLocalDateTime(state.date, state.startTime);
  const requestedEnd = toLocalDateTime(state.date, state.endTime);
  if (!requestedStart || !requestedEnd) return null;
  const durationMs = requestedEnd.getTime() - requestedStart.getTime();
  if (durationMs <= 0) return null;

  let candidateStart = new Date(requestedEnd.getTime());
  const latestEnd = new Date(`${state.date}T23:59:00`);

  while (true) {
    const candidateEnd = new Date(candidateStart.getTime() + durationMs);
    if (candidateEnd > latestEnd) break;

    const candidateState = {
      ...state,
      startTime: `${String(candidateStart.getHours()).padStart(2, '0')}:${String(candidateStart.getMinutes()).padStart(2, '0')}`,
      endTime: `${String(candidateEnd.getHours()).padStart(2, '0')}:${String(candidateEnd.getMinutes()).padStart(2, '0')}`
    };

    const availableRooms = await searchRooms(rooms, candidateState, findOverlap);
    for (const room of availableRooms) {
      if (isMS365Enabled() && room.outlookEmail) {
        const roomFree = await checkRoomCalendar(room.outlookEmail, candidateStart, candidateEnd, accessToken);
        if (!roomFree) continue;
      }
      const peopleToCheck = [
        requesterEmail,
        ...(state.participants || [])
      ].filter(Boolean);

      const conflicts = await checkParticipantConflicts({
        participants: peopleToCheck,
        startTime: candidateStart,
        endTime: candidateEnd,
        accessToken,
        checkParticipantAvailability: checkParticipantCalendar
      });
      if (conflicts.length === 0) {
        return {
          date: state.date,
          startTime: candidateState.startTime,
          endTime: candidateState.endTime,
          roomId: room.id || room._id?.toString() || room.name,
          roomName: room.name,
          room
        };
      }
    }
    candidateStart = new Date(candidateStart.getTime() + 15 * 60 * 1000);
  }
  return null;
};

export const createChatHandler = ({
  getRooms = fetchRooms,
  findOverlap = findOverlappingBooking,
  saveBooking = createBooking,
  isCalendarEnabled = isMS365Enabled,
  checkCalendar = checkRoomAvailability,
  createCalendarEvent = createRoomBookingEvent,
  checkParticipantAvailability = checkTeammatesAvailability
} = {}) => async (message, session, user) => {

  const cleanMessage = String(message || '').trim();
  const nextSession = ensureTodaySession(session);
  const state = nextSession.bookingData;
  const today = getToday();

  if (!cleanMessage) return { reply: 'Please provide the booking details.', session: nextSession };
  if (isCancelMessage(cleanMessage)) return { reply: 'Booking cancelled. Start a new request whenever you are ready.', session: resetSession() };

  const rooms = await getRooms(user);
  if (!rooms || rooms.length === 0) return { reply: 'I could not find any configured meeting rooms right now. Please try again later.', session: nextSession };

  // Parse whole message
  const extracted = extractBookingDetails(cleanMessage, rooms, state, nextSession.expectedField);

  console.log('\n========== SLOTBOT DEBUG ==========');
  console.log('MESSAGE          :', cleanMessage);
  console.log('STEP (incoming)  :', nextSession.step);
  console.log('EXPECTED FIELD   :', nextSession.expectedField);
  console.log('STATE (before)   :', JSON.stringify(state));
  console.log('EXTRACTED FIELDS :', JSON.stringify(extracted));
  console.log('====================================\n');

  // If we were awaiting a decision, parse it specifically
  if (nextSession.step === STATES.AWAITING_CONFLICT_DECISION) {
    const decision = parseConflictDecision(cleanMessage);
    if (decision) extracted.conflictDecision = decision;
  } else if (nextSession.step === STATES.AWAITING_FINAL_CONFIRMATION) {
    const confirm = parseConfirmation(cleanMessage);
    if (confirm !== null) extracted.confirmation = confirm;
  }

  // Reject past dates gracefully
  if (extracted.date && extracted.date !== today) {
    nextSession.step = STATES.COLLECTING_DETAILS;
    nextSession.expectedField = EXPECTED_FIELDS.START_TIME;
    return {
      reply: '⚠️ SlotBot currently supports bookings only for the remaining time slots today. Please provide a future time for today.',
      session: nextSession
    };
  }

  // Merge extracted values
  nextSession.bookingData = mergeBookingState(state, extracted);
  const current = nextSession.bookingData;

  console.log('MERGED STATE      :', JSON.stringify(current));

  // Validate attendee count
  if (current.attendeeCount !== null && current.attendeeCount !== undefined) {
    if (!Number.isInteger(current.attendeeCount) || current.attendeeCount < 1) {
      current.attendeeCount = null;
      nextSession.step = STATES.COLLECTING_DETAILS;
      nextSession.expectedField = EXPECTED_FIELDS.ATTENDEE_COUNT;
      return { reply: 'Please provide an attendee count of at least 1.', session: nextSession };
    }
    const maxCapacity = rooms.reduce((max, room) => Math.max(max, Number(room.capacity || 0)), 0);
    if (current.attendeeCount > maxCapacity) {
      current.attendeeCount = null;
      nextSession.step = STATES.COLLECTING_DETAILS;
      nextSession.expectedField = EXPECTED_FIELDS.ATTENDEE_COUNT;
      return { reply: `Our largest room seats ${maxCapacity}. How many people will attend?`, session: nextSession };
    }
  }

  // Validate times
  if (current.startTime && current.endTime) {
    const start = toLocalDateTime(today, current.startTime);
    const end = toLocalDateTime(today, current.endTime);
    if (!start || !end) {
      current.startTime = null; current.endTime = null;
      nextSession.step = STATES.COLLECTING_DETAILS;
      nextSession.expectedField = EXPECTED_FIELDS.START_TIME;
      return { reply: 'I could not understand the meeting time. What time should it start?', session: nextSession };
    }
    if (end <= start) {
      current.endTime = null;
      nextSession.step = STATES.COLLECTING_DETAILS;
      nextSession.expectedField = EXPECTED_FIELDS.END_TIME;
      return { reply: 'The end time must be after the start time. What time should the meeting end?', session: nextSession };
    }
  }

  // Check past times
  if (current.startTime && !isFutureTodayTime(today, current.startTime)) {
    current.startTime = null; current.endTime = null;
    nextSession.step = STATES.COLLECTING_DETAILS;
    nextSession.expectedField = EXPECTED_FIELDS.START_TIME;
    return { reply: 'Please choose a start time later than the current time. SlotBot only allows future bookings.', session: nextSession };
  }

  // Validate that a room selection actually satisfies the current
  // requirements (capacity, TV, booking-duration bounds, and no
  // overlap). extractRoom() matches against ALL rooms regardless of
  // fit, so a user can type a room name that was never part of the
  // filtered search results (e.g. selecting a 6-seat room after
  // asking for 8 people). Only re-run this check right when a room
  // was just selected this turn, not on every subsequent message.
  if (
    extracted.selectedRoomId &&
    current.selectedRoomId === extracted.selectedRoomId &&
    current.attendeeCount != null &&
    current.startTime &&
    current.endTime &&
    current.tvRequired !== null
  ) {
    const validRooms = await searchRooms(rooms, current, findOverlap);
    const isValid = validRooms.some(
      room => (room.id || room._id?.toString() || room.name) === current.selectedRoomId
    );

    if (!isValid) {
      const rejectedName = current.selectedRoomName;
      current.selectedRoomId = null;
      current.selectedRoomName = null;
      nextSession.step = STATES.AWAITING_ROOM_SELECTION;
      nextSession.expectedField = EXPECTED_FIELDS.ROOM;

      if (validRooms.length === 0) {
        return {
          reply: `❌ **${rejectedName}** doesn't meet your current requirements (capacity, TV, or availability), and no other rooms match either right now. Please provide another start time.`,
          session: nextSession
        };
      }

      return {
        reply: `❌ **${rejectedName}** doesn't meet your current requirements (capacity for ${current.attendeeCount} people${current.tvRequired ? ', TV availability,' : ''} or the requested time). Please select one of these instead:`,
        session: nextSession,
        roomsList: validRooms.map(roomDto)
      };
    }
  }

  // Handle conflict decisions
  if (extracted.conflictDecision) {
    if (extracted.conflictDecision === CONFLICT_ACTIONS.CANCEL) {
      return { reply: 'Booking cancelled.', session: resetSession() };
    }
    if (extracted.conflictDecision === CONFLICT_ACTIONS.CONFIRM_SUGGESTION) {
      const suggestion = current.suggestedBooking;
      if (!suggestion) {
        nextSession.step = STATES.AWAITING_FINAL_CONFIRMATION;
        nextSession.expectedField = EXPECTED_FIELDS.CONFIRMATION;
        return { reply: 'The suggested booking is no longer available. Please confirm whether you want to continue with the original booking.', session: nextSession };
      }
      current.date = suggestion.date;
      current.startTime = suggestion.startTime;
      current.endTime = suggestion.endTime;
      current.selectedRoomId = suggestion.roomId;
      current.selectedRoomName = suggestion.roomName;
      current.conflicts = null;
      current.suggestedBooking = null;
    }
    if (extracted.conflictDecision === CONFLICT_ACTIONS.FORCE_BOOK) {
      current.forceBooking = true;
      current.conflicts = null;
      current.suggestedBooking = null;
    }
  }

  // Find next state
  const nextStateInfo = determineNextState({ state: current, roomsAvailable: true });
  nextSession.step = nextStateInfo.step;
  nextSession.expectedField = nextStateInfo.expectedField;

  console.log('NEXT STATE        :', nextStateInfo.step, '| action:', nextStateInfo.action, '| expectedField:', nextStateInfo.expectedField);
  console.log('====================================\n');

  // Execute actions based on state transition
  switch (nextStateInfo.action) {
    case 'ASK_QUESTION':
    case 'ASK_SUBJECT':
    case 'ASK_DESCRIPTION':
      return { reply: nextStateInfo.question || 'Please provide ' + nextStateInfo.expectedField, session: nextSession };

    case 'SHOW_ROOMS': {
      const roomSearch = await searchRooms(
        rooms,
        current,
        findOverlap,
        { explain: true }
      );

      const availableRooms = roomSearch.availableRooms;
      const rejectedRooms = roomSearch.rejectedRooms;

      if (availableRooms.length === 0) {

        current.selectedRoomId = null;
        current.selectedRoomName = null;

        nextSession.step = STATES.COLLECTING_DETAILS;
        nextSession.expectedField = EXPECTED_FIELDS.START_TIME;

        const reasonLines = rejectedRooms.map(({ room, reason }) => {
          return `• **${room.name}** — ${reason}`;
        });

        return {
          reply:
            `❌ **No rooms are available for your request.**\n\n` +
            `**Requested:**\n` +
            `👥 People: ${current.attendeeCount}\n` +
            `🕒 Time: ${formatTime(current.startTime)} – ${formatTime(current.endTime)}` +
            `${current.tvRequired ? '\n📺 TV: Required' : ''}\n\n` +
            `**Why the rooms were rejected:**\n` +
            `${reasonLines.length ? reasonLines.join('\n') : 'No matching rooms were found.'}\n\n` +
            `Please provide another time, and I will check the rooms again.`,

          session: nextSession
        };
      }

      return {
        reply: 'I found these rooms that best match your requirements. Please select one:',
        session: nextSession,
        roomsList: availableRooms.map(roomDto)
      };
    }

    case 'ASK_PARTICIPANTS':
      const selectedRoom = rooms.find(room => room.id === current.selectedRoomId || room._id?.toString() === String(current.selectedRoomId) || room.name === current.selectedRoomId);
      return {
        reply: 'Who should receive the meeting invitation? Enter teammate email addresses separated by commas, or type **none**.',
        session: nextSession,
        selectedRoom: selectedRoom ? roomDto(selectedRoom) : undefined
      };

    case 'SHOW_CONFLICT_OPTIONS':
      // Actually, if we are transitioning to AWAITING_FINAL_CONFIRMATION, we need to check conflicts if not already checked!
      break;

    case 'ASK_CONFIRMATION':
      // We are at final confirmation. But wait, did we check conflicts?
      break;
  }

  // Let's modify the orchestration slightly.
  // Instead of completely relying on determineNextState to trigger the calendar checks, 
  // we can intercept BEFORE nextStateInfo if participants are set but conflicts haven't been checked!

  if (
    current.participants !== null &&
    current.conflicts === null &&
    !current.forceBooking
  ) {

    console.log(
      '\n========== CONFLICT CHECK START =========='
    );

    const startTime = toLocalDateTime(
      today,
      current.startTime
    );

    const endTime = toLocalDateTime(
      today,
      current.endTime
    );

    /*
     * Get the requester/organizer email.
     *
     * Depending on how your Microsoft login user object
     * is created, one of these should contain the email.
     */
    const requesterEmail =
      user?.mail ||
      user?.email ||
      user?.userPrincipalName;

    console.log(
      'Requester:',
      requesterEmail
    );

    console.log(
      'Teammates:',
      current.participants
    );

    /*
     * Check requester + teammates together.
     */
    const peopleToCheck = [
      requesterEmail,
      ...(current.participants || [])
    ].filter(Boolean);

    /*
     * Remove duplicate emails.
     */
    const uniquePeopleToCheck = [
      ...new Set(
        peopleToCheck.map(
          email => email.toLowerCase()
        )
      )
    ];

    console.log(
      'People being checked:',
      uniquePeopleToCheck
    );

    /*
     * Check Microsoft 365 calendars.
     */
    const conflicts = await checkParticipantConflicts({
      participants: uniquePeopleToCheck,
      startTime,
      endTime,
      accessToken: user?.accessToken,
      checkParticipantAvailability
    });

    console.log(
      'Calendar conflicts:',
      JSON.stringify(conflicts, null, 2)
    );

    console.log(
      '========== CONFLICT CHECK END ==========\n'
    );

    /*
     * --------------------------------------------------
     * CONFLICT FOUND
     * --------------------------------------------------
     */
    if (conflicts.length > 0) {

      current.conflicts = conflicts;

      /*
       * Find an alternative time where:
       *
       * 1. Room is available
       * 2. Requester is available
       * 3. All teammates are available
       */
      const suggestion = await findNearestAlternative({
        rooms,
        state: current,
        findOverlap,
        checkRoomCalendar: checkCalendar,
        checkParticipantCalendar: checkParticipantAvailability,
        accessToken: user?.accessToken,
        requesterEmail
      });

      current.suggestedBooking = suggestion;

      nextSession.step =
        STATES.AWAITING_CONFLICT_DECISION;

      nextSession.expectedField =
        EXPECTED_FIELDS.CONFLICT_DECISION;

      /*
       * Separate requester conflicts from teammate conflicts
       * so the message is clearer.
       */
      const requesterConflict =
        conflicts.find(
          conflict =>
            conflict.email?.toLowerCase() ===
            requesterEmail?.toLowerCase()
        );

      const teammateConflicts =
        conflicts.filter(
          conflict =>
            conflict.email?.toLowerCase() !==
            requesterEmail?.toLowerCase()
        );

      let conflictMessage =
        '⚠️ **Calendar conflicts found.**\n\n';

      if (requesterConflict) {
        conflictMessage +=
          `👤 **You** already have a calendar event during this time.\n\n`;
      }

      if (teammateConflicts.length > 0) {
        conflictMessage +=
          `👥 **Teammate conflicts:**\n`;

        conflictMessage += teammateConflicts
          .map(
            conflict =>
              `• **${conflict.email}**`
          )
          .join('\n');

        conflictMessage += '\n\n';
      }

      /*
       * Alternative found.
       */
      if (suggestion) {

        conflictMessage +=
          `I found the nearest time where the room and all checked calendars are available:\n\n`;

        conflictMessage +=
          `🏢 **${suggestion.roomName}**\n`;

        conflictMessage +=
          `🕒 **${formatTime(
            suggestion.startTime
          )} – ${formatTime(
            suggestion.endTime
          )}**\n\n`;

        conflictMessage +=
          `What would you like to do?\n\n`;

        conflictMessage +=
          `**1. Confirm with suggestion**\n`;

        conflictMessage +=
          `**2. Force book despite calendar conflicts**\n`;

        conflictMessage +=
          `**3. Cancel**`;

        return {
          reply: conflictMessage,
          session: nextSession,
          conflicts,
          suggestedBooking: suggestion
        };
      }

      /*
       * No alternative found.
       */
      conflictMessage +=
        `I could not find another conflict-free slot later today.\n\n`;

      conflictMessage +=
        `What would you like to do?\n\n`;

      conflictMessage +=
        `**1. Continue with the original time**\n`;

      conflictMessage +=
        `**2. Force book despite calendar conflicts**\n`;

      conflictMessage +=
        `**3. Cancel**`;

      return {
        reply: conflictMessage,
        session: nextSession,
        conflicts
      };
    }

    /*
     * --------------------------------------------------
     * NO CONFLICT
     * --------------------------------------------------
     */

    console.log(
      '✅ Requester and all teammates are available.'
    );

    /*
     * Empty array means:
     *
     * "Calendar check has been completed and nobody
     * has a conflict."
     */
    current.conflicts = [];
  }

  // Now, what if the user confirmed?
  if (nextStateInfo.action === 'ASK_CONFIRMATION') {
    if (extracted.confirmation === false) {
      return { reply: 'Booking cancelled.', session: resetSession() };
    }
    if (extracted.confirmation === true) {
      // PROCEED TO BOOK
      const room = rooms.find(item => item.id === current.selectedRoomId || item._id?.toString() === String(current.selectedRoomId) || item.name === current.selectedRoomId);
      const startTime = toLocalDateTime(today, current.startTime);
      const endTime = toLocalDateTime(today, current.endTime);
      if (!isFutureTodayTime(today, current.startTime)) {
        nextSession.step = STATES.COLLECTING_DETAILS;
        nextSession.expectedField = EXPECTED_FIELDS.START_TIME;
        return { reply: '⚠️ That time has already passed. Please provide a new start time.', session: nextSession };
      }

      if (Number(room.capacity || 0) < Number(current.attendeeCount)) {
        current.selectedRoomId = null; current.selectedRoomName = null;
        nextSession.step = STATES.AWAITING_ROOM_SELECTION;
        nextSession.expectedField = EXPECTED_FIELDS.ROOM;
        return {
          reply: `❌ **${room.name}** no longer fits ${current.attendeeCount} attendees. Please select another room.`,
          session: nextSession,
          roomsList: (await searchRooms(rooms, current, findOverlap)).map(roomDto)
        };
      }

      if (current.tvRequired === true && !room.tvAvailability) {
        current.selectedRoomId = null; current.selectedRoomName = null;
        nextSession.step = STATES.AWAITING_ROOM_SELECTION;
        nextSession.expectedField = EXPECTED_FIELDS.ROOM;
        return {
          reply: `❌ **${room.name}** no longer has a TV available. Please select another room.`,
          session: nextSession,
          roomsList: (await searchRooms(rooms, current, findOverlap)).map(roomDto)
        };
      }

      const durationHours = (endTime - startTime) / 36e5;
      if (room.minBookingHours != null && durationHours < Number(room.minBookingHours)) {
        return { reply: `❌ **${room.name}** requires at least ${room.minBookingHours}h bookings.`, session: nextSession };
      }
      if (room.maxBookingHours != null && durationHours > Number(room.maxBookingHours)) {
        return { reply: `❌ **${room.name}** allows at most ${room.maxBookingHours}h bookings.`, session: nextSession };
      }

      const actualAttendees = (current.participants?.length || 0) + 1;
      if (current.attendeeCount != null && actualAttendees !== current.attendeeCount) {
        return {
          reply: `You originally specified ${current.attendeeCount} attendees, but your participants would make ${actualAttendees} including you. Please update the attendee count or remove participants.`,
          session: nextSession
        };
      }
      const dbOverlap = await findOverlap(room.name, startTime, endTime);
      if (dbOverlap) {
        current.selectedRoomId = null; current.selectedRoomName = null;
        nextSession.step = STATES.AWAITING_ROOM_SELECTION;
        nextSession.expectedField = EXPECTED_FIELDS.ROOM;
        return {
          reply: `❌ **${room.name}** was just booked for that time. Please select another available room.`,
          session: nextSession,
          roomsList: (await searchRooms(rooms, current, findOverlap)).map(roomDto)
        };
      }

      if (isCalendarEnabled() && room.outlookEmail) {
        const roomFree = await checkCalendar(room.outlookEmail, startTime, endTime, user?.accessToken);
        if (!roomFree) {
          current.selectedRoomId = null; current.selectedRoomName = null;
          nextSession.step = STATES.AWAITING_ROOM_SELECTION;
          nextSession.expectedField = EXPECTED_FIELDS.ROOM;
          return {
            reply: `❌ **${room.name}** is no longer available during that time. Please select another room.`,
            session: nextSession,
            roomsList: (await searchRooms(rooms, current, findOverlap)).map(roomDto)
          };
        }
      }

      const booking = await saveBooking({
        roomName: room.name,
        peopleCount: current.attendeeCount,
        startTime, endTime,
        date: toLocalDateTime(today, '00:00'),
        teammates: current.participants || [],
        subject: current.subject,
        description: current.description
      }, user);

      let teamsLink = null;
      if (isCalendarEnabled() && room.outlookEmail && user?.accessToken) {
        try {
          const graphResult = await createCalendarEvent({
            userAccessToken: user.accessToken,
            roomName: room.name,
            outlookEmail: room.outlookEmail,
            startTime, endTime,
            peopleCount: current.attendeeCount,
            teammates: current.participants || [],
            meetingTitle: current.subject,
            description: current.description
          });
          if (graphResult) {
            booking.outlookEventId = graphResult.outlookEventId;
            booking.teamsLink = graphResult.teamsLink;
            await booking.save();
            teamsLink = graphResult.teamsLink;
          }
        } catch (error) {
          console.error('Microsoft 365 sync failed:', error.message);
        }
      }

      return {
        reply: `🎉 **Success!**\n\n**Room:** ${room.name}\n**Time:** ${formatTime(current.startTime)} – ${formatTime(current.endTime)}\n**People:** ${current.attendeeCount}\n**TV:** ${current.tvRequired ? 'Yes' : 'No'}\n\nYour booking has been confirmed.`,
        session: resetSession(),
        bookingConfirmed: true,
        teamsLink
      };
    }

    // Normal confirmation prompt
    return {
      reply: `✅ Everything looks good.\n\n**Room:** ${current.selectedRoomName}\n**Time:** ${formatTime(current.startTime)} – ${formatTime(current.endTime)}\n**People:** ${current.attendeeCount}\n**TV:** ${current.tvRequired ? 'Yes' : 'No'}\n**Teammates:** ${current.participants && current.participants.length ? current.participants.join(', ') : 'None'}\n**Subject:** ${current.subject}\n**Description:** ${current.description || 'None'}\n\n${current.forceBooking ? '⚠️ **WARNING: Some teammates have calendar conflicts during this time.**\n\n' : ''}Would you like me to confirm this booking?`,
      session: nextSession,
      showConfirmation: true
    };
  }

  // Recompute next state if we didn't return
  const finalStateInfo = determineNextState({ state: current, roomsAvailable: true });
  nextSession.step = finalStateInfo.step;
  nextSession.expectedField = finalStateInfo.expectedField;

  if (finalStateInfo.action === 'ASK_SUBJECT') return { reply: 'What should the meeting invitation title be? For example: **Sprint planning**.', session: nextSession };
  if (finalStateInfo.action === 'ASK_DESCRIPTION') return { reply: 'Please provide the meeting description or agenda. Type **none** to leave it blank.', session: nextSession };

  return { reply: 'Please provide the missing details.', session: nextSession };
};

export const handleChat = createChatHandler();