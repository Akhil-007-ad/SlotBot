import {
  createBooking,
  findOverlappingBooking
} from '../services/bookingService.js';

import {
  checkRoomAvailability,
  createRoomBookingEvent,
  isMS365Enabled
} from '../services/graphService.js';

import { getChatRooms } from '../services/roomService.js';

import {
  createBookingSession,
  emptyBookingState,
  mergeBookingState,
  missingSearchFields
} from './bookingSession.js';

import {
  extractBookingDetails,
  toLocalDateTime
} from './extraction.js';


export const fetchRooms = getChatRooms;


/**
 * Returns today's date in YYYY-MM-DD format.
 */
const getToday = () => {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
};


/**
 * Formats a HH:mm time for chat display.
 */
const formatTime = value => {
  if (!value) return '';

  return new Date(`2000-01-01T${value}`)
    .toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
};


/**
 * Converts a room database object into the DTO expected by the frontend.
 */
const roomDto = room => ({
  id: room.id || room._id?.toString() || room.name,
  name: room.name,
  capacity: room.capacity,
  hasTv: Boolean(room.tvAvailability),
  location: [room.floor, room.location]
    .filter(Boolean)
    .join(' · ')
});


/**
 * Creates a completely fresh booking session.
 *
 * The booking date is always today because SlotBot
 * supports only future bookings for the current day.
 */
const resetSession = () => {
  const bookingData = emptyBookingState();

  bookingData.date = getToday();

  return {
    step: 'COLLECTING_DETAILS',
    bookingData
  };
};


/**
 * Ensures that a restored/old session also uses today's date.
 */
const ensureTodaySession = session => {
  const nextSession = createBookingSession(session);
  const today = getToday();

  if (!nextSession.bookingData) {
    nextSession.bookingData = emptyBookingState();
  }

  nextSession.bookingData.date = today;

  return nextSession;
};


/**
 * Searches rooms based on:
 * - attendee capacity
 * - TV requirement
 * - booking duration rules
 * - existing booking conflicts
 */
const searchRooms = async (rooms, state, findOverlap) => {
  const start = toLocalDateTime(
    state.date,
    state.startTime
  );

  const end = toLocalDateTime(
    state.date,
    state.endTime
  );

  const durationHours = (end - start) / 36e5;

  const availableRooms = [];

  for (const room of rooms) {
    /*
     * Capacity check.
     */
    if (room.capacity < state.attendeeCount) {
      continue;
    }

    /*
     * TV requirement check.
     *
     * If the user requires a TV, rooms without a TV
     * are excluded.
     */
    if (
      state.tvRequired === true &&
      !room.tvAvailability
    ) {
      continue;
    }

    /*
     * Booking duration validation.
     */
    if (
      room.minBookingHours != null &&
      durationHours < room.minBookingHours
    ) {
      continue;
    }

    if (
      room.maxBookingHours != null &&
      durationHours > room.maxBookingHours
    ) {
      continue;
    }

    /*
     * Prevent room double-booking.
     */
    const overlaps = await findOverlap(
      room.name,
      start,
      end
    );

    if (overlaps) {
      continue;
    }

    availableRooms.push(room);
  }

  return availableRooms;
};


/**
 * Determines whether the user message contains
 * actual booking information.
 *
 * This prevents messages such as:
 *
 * "Actually make it for 10 people"
 *
 * from being incorrectly saved as the meeting subject
 * or description while those fields are being collected.
 */
const hasBookingChanges = extracted => {
  return (
    extracted.attendeeCount !== undefined ||
    extracted.date !== undefined ||
    extracted.startTime !== undefined ||
    extracted.endTime !== undefined ||
    extracted.tvRequired !== undefined ||
    extracted.selectedRoomId !== undefined
  );
};


/**
 * Checks whether a time is strictly in the future today.
 */
const isFutureTodayTime = (date, time) => {
  if (!date || !time) {
    return false;
  }

  const dateTime = toLocalDateTime(date, time);

  if (!dateTime) {
    return false;
  }

  return dateTime.getTime() > Date.now();
};


/**
 * Creates the main SlotBot chat handler.
 */
export const createChatHandler = ({
  getRooms = fetchRooms,
  findOverlap = findOverlappingBooking,
  saveBooking = createBooking,
  isCalendarEnabled = isMS365Enabled,
  checkCalendar = checkRoomAvailability,
  createCalendarEvent = createRoomBookingEvent
} = {}) => async (message, session, user) => {

  /*
   * Always work with today's booking date.
   */
  const nextSession = ensureTodaySession(session);

  const cleanMessage = message?.trim() || '';
  const lower = cleanMessage.toLowerCase();

  const today = getToday();


  // ============================================================
  // 1. GLOBAL CANCEL / RESET ACTIONS
  // ============================================================

  if (/^(cancel|reset|restart|start over)$/i.test(lower)) {
    return {
      reply:
        'Booking process cancelled. Start a new request whenever you are ready.',
      session: resetSession()
    };
  }


  // ============================================================
  // 2. LOAD ROOMS
  // ============================================================

  const rooms = await getRooms(user);


  // ============================================================
  // 3. EXTRACT ALL AVAILABLE INFORMATION FROM EVERY MESSAGE
  //
  // This happens regardless of the current conversation step.
  // ============================================================

  const extracted = extractBookingDetails(
    cleanMessage,
    rooms,
    nextSession.bookingData
  );


  /*
   * If the user explicitly says there are no participants,
   * normalize that to an empty array.
   */
  if (/^(none|only me|just me)$/i.test(lower)) {
    extracted.participants = [];
  }


  /*
   * Check whether this message contains actual booking changes
   * before using the entire message as a subject or description.
   */
  const bookingChanged = hasBookingChanges(extracted);


  // ============================================================
  // 4. HANDLE SUBJECT INPUT SAFELY
  // ============================================================

  if (
    nextSession.step === 'AWAITING_SUBJECT' &&
    extracted.subject === undefined &&
    !bookingChanged &&
    cleanMessage
  ) {
    extracted.subject = cleanMessage;
  }


  // ============================================================
  // 5. HANDLE DESCRIPTION INPUT SAFELY
  // ============================================================

  if (
    nextSession.step === 'AWAITING_DESCRIPTION' &&
    extracted.description === undefined &&
    !bookingChanged &&
    cleanMessage
  ) {
    extracted.description =
      /^(none|no description)$/i.test(lower)
        ? ''
        : cleanMessage;
  }


  // ============================================================
  // 6. MERGE EXTRACTED INFORMATION INTO BOOKING STATE
  //
  // This is the core of dynamic slot filling.
  // ============================================================

  nextSession.bookingData = mergeBookingState(
    nextSession.bookingData,
    extracted
  );

  const state = nextSession.bookingData;


  // ============================================================
  // 7. ENFORCE TODAY-ONLY BOOKINGS
  // ============================================================

  /*
   * If the user explicitly requested another date,
   * do not silently book that time today.
   *
   * Inform the user that SlotBot only supports today's
   * remaining time slots.
   */
  if (
    extracted.date &&
    extracted.date !== today
  ) {
    state.date = today;

    return {
      reply:
        '⚠️ SlotBot currently supports bookings only for the remaining time slots today. Please provide a future time for today.',
      session: nextSession
    };
  }


  /*
   * Date is always today internally.
   */
  state.date = today;


  // ============================================================
  // 8. EXPLICIT CONFIRMATION
  //
  // Confirmation is handled after extraction and merge.
  // ============================================================

  if (
    nextSession.step === 'AWAITING_CONFIRMATION' &&
    /^(confirm|yes|approve)$/i.test(lower)
  ) {
    const room = rooms.find(
      item =>
        item.id === state.selectedRoomId ||
        item._id?.toString() === state.selectedRoomId ||
        item.name === state.selectedRoomId
    );

    const startTime = toLocalDateTime(
      state.date,
      state.startTime
    );

    const endTime = toLocalDateTime(
      state.date,
      state.endTime
    );


    /*
     * Final validation before booking.
     */
    if (!room || !startTime || !endTime) {
      nextSession.step = 'COLLECTING_DETAILS';

      return {
        reply:
          'Some booking information is missing. Please provide the meeting timing again.',
        session: nextSession
      };
    }


    /*
     * Start time must still be in the future at confirmation time.
     */
    if (startTime.getTime() <= Date.now()) {
      nextSession.step = 'COLLECTING_DETAILS';
      state.startTime = null;
      state.endTime = null;
      state.selectedRoomId = null;

      return {
        reply:
          '⚠️ That meeting time has already started or passed. Please choose a future time today.',
        session: nextSession
      };
    }


    /*
     * End must be after start.
     */
    if (endTime <= startTime) {
      nextSession.step = 'COLLECTING_DETAILS';
      state.endTime = null;
      state.selectedRoomId = null;

      return {
        reply:
          'The end time must be after the start time. What time should the meeting end?',
        session: nextSession
      };
    }


    /*
     * Final database overlap check.
     * A room must never be double-booked.
     */
    if (
      await findOverlap(
        room.name,
        startTime,
        endTime
      )
    ) {
      nextSession.step = 'AWAITING_ROOM_SELECTION';
      state.selectedRoomId = null;

      return {
        reply:
          `❌ **${room.name}** was just booked for that time. Please select another available room.`,
        session: nextSession
      };
    }


    /*
     * Final Microsoft 365 availability check.
     */
    if (
      isCalendarEnabled() &&
      room.outlookEmail
    ) {
      const free = await checkCalendar(
        room.outlookEmail,
        startTime,
        endTime,
        user?.accessToken
      );

      if (!free) {
        nextSession.step = 'AWAITING_ROOM_SELECTION';
        state.selectedRoomId = null;

        return {
          reply:
            `❌ **${room.name}** is no longer available during that time. Please select another room.`,
          session: nextSession
        };
      }
    }


    // ==========================================================
    // CREATE DATABASE BOOKING
    // ==========================================================

    const booking = await saveBooking(
      {
        roomName: room.name,
        peopleCount: state.attendeeCount,
        startTime,
        endTime,
        date: toLocalDateTime(today, '00:00'),
        teammates: state.participants,
        subject: state.subject,
        description: state.description
      },
      user
    );


    // ==========================================================
    // CREATE MICROSOFT 365 EVENT
    // ==========================================================

    let teamsLink = null;

    if (
      isCalendarEnabled() &&
      room.outlookEmail &&
      user?.accessToken
    ) {
      try {
        const graphResult =
          await createCalendarEvent({
            userAccessToken: user.accessToken,
            roomName: room.name,
            outlookEmail: room.outlookEmail,
            startTime,
            endTime,
            peopleCount: state.attendeeCount,
            teammates: state.participants,
            meetingTitle: state.subject,
            description: state.description
          });

        booking.outlookEventId =
          graphResult.outlookEventId;

        booking.teamsLink =
          graphResult.teamsLink;

        await booking.save();

        teamsLink = graphResult.teamsLink;

      } catch (error) {
        console.error(
          'Microsoft 365 sync failed:',
          error.message
        );
      }
    }


    return {
      reply:
        `🎉 **Success!** **${room.name}** is booked today from **${formatTime(state.startTime)}** to **${formatTime(state.endTime)}**.`,
      session: resetSession(),
      bookingConfirmed: true,
      teamsLink
    };
  }


  // ============================================================
  // 9. EXPLICIT CANCELLATION AT CONFIRMATION
  // ============================================================

  if (
    nextSession.step === 'AWAITING_CONFIRMATION' &&
    /^(cancel|no)$/i.test(lower)
  ) {
    return {
      reply: 'Booking cancelled.',
      session: resetSession()
    };
  }


  // ============================================================
  // 10. VALIDATE ATTENDEE COUNT
  // ============================================================

  if (
    state.attendeeCount !== null &&
    state.attendeeCount !== undefined &&
    (
      !Number.isInteger(state.attendeeCount) ||
      state.attendeeCount < 1
    )
  ) {
    state.attendeeCount = null;
    state.selectedRoomId = null;

    return {
      reply:
        'Please provide an attendee count of at least 1.',
      session: nextSession
    };
  }


  const maxCapacity = rooms.reduce(
    (max, room) =>
      Math.max(max, room.capacity || 0),
    0
  );


  if (
    state.attendeeCount &&
    state.attendeeCount > maxCapacity
  ) {
    state.attendeeCount = null;
    state.selectedRoomId = null;

    return {
      reply:
        `Our largest room seats ${maxCapacity}. How many people will attend?`,
      session: nextSession
    };
  }


  // ============================================================
  // 11. VALIDATE TIME ORDER
  // ============================================================

  if (
    state.startTime &&
    state.endTime
  ) {
    const start = toLocalDateTime(
      today,
      state.startTime
    );

    const end = toLocalDateTime(
      today,
      state.endTime
    );

    if (end <= start) {
      state.endTime = null;
      state.selectedRoomId = null;

      return {
        reply:
          'The end time must be after the start time. What time should the meeting end?',
        session: nextSession
      };
    }
  }


  // ============================================================
  // 12. VALIDATE THAT START TIME IS IN THE FUTURE
  //
  // Only future bookings for TODAY are allowed.
  // ============================================================

  if (
    state.startTime &&
    !isFutureTodayTime(today, state.startTime)
  ) {
    state.startTime = null;
    state.endTime = null;
    state.selectedRoomId = null;

    return {
      reply:
        '⚠️ Please choose a start time later than the current time. SlotBot only allows future bookings for today.',
      session: nextSession
    };
  }


  // ============================================================
  // 13. CHECK FOR MISSING ROOM SEARCH FIELDS
  //
  // Date should not be requested because it is always today.
  // ============================================================

  const missing = missingSearchFields(state);

  /*
   * Safety filter in case missingSearchFields still includes date.
   */
  const actualMissing = missing.filter(
    field =>
      !/date|today/i.test(field)
  );


  if (actualMissing.length) {
    nextSession.step = 'COLLECTING_DETAILS';

    return {
      reply: actualMissing[0],
      session: nextSession
    };
  }


  // ============================================================
  // 14. SEARCH AVAILABLE ROOMS
  // ============================================================

  const availableRooms = await searchRooms(
    rooms,
    state,
    findOverlap
  );


  if (!availableRooms.length) {
    /*
     * Clear selection because the previous room may
     * no longer satisfy the new search requirements.
     */
    state.selectedRoomId = null;
    nextSession.step = 'COLLECTING_DETAILS';

    return {
      reply:
        `No rooms are available today for **${state.attendeeCount} people** from **${formatTime(state.startTime)}** to **${formatTime(state.endTime)}**${state.tvRequired ? ' with a TV' : ''}. Try changing the time or requirements.`,
      session: nextSession
    };
  }


  // ============================================================
  // 15. VALIDATE SELECTED ROOM
  // ============================================================

  const selectedRoom = availableRooms.find(
    room =>
      room.id === state.selectedRoomId ||
      room._id?.toString() === state.selectedRoomId ||
      room.name === state.selectedRoomId
  );


  /*
   * No valid room selected yet.
   *
   * Return structured room objects so the frontend
   * can render clickable cards.
   */
  if (!selectedRoom) {
    /*
     * Remove an old/invalid selection.
     */
    state.selectedRoomId = null;

    nextSession.step = 'AWAITING_ROOM_SELECTION';

    return {
      reply:
        'Please select one of the available rooms:',
      session: nextSession,
      roomsList: availableRooms.map(roomDto)
    };
  }


  // ============================================================
  // 16. COLLECT PARTICIPANTS
  //
  // Do not block extraction of future booking changes.
  // ============================================================

  if (state.participants === null) {
    nextSession.step = 'AWAITING_PARTICIPANTS';

    return {
      reply:
        'Who should receive the meeting invite? Enter teammate email addresses separated by commas, or type **none**.',
      session: nextSession
    };
  }


  // ============================================================
  // 17. COLLECT MEETING SUBJECT
  // ============================================================

  if (!state.subject) {
    nextSession.step = 'AWAITING_SUBJECT';

    return {
      reply:
        'What should the meeting invitation title be? For example: `Sprint planning`.',
      session: nextSession
    };
  }


  // ============================================================
  // 18. COLLECT DESCRIPTION
  // ============================================================

  if (state.description === null) {
    nextSession.step = 'AWAITING_DESCRIPTION';

    return {
      reply:
        'Please provide the meeting description or agenda. Type **none** to leave it blank.',
      session: nextSession
    };
  }


  // ============================================================
  // 19. SHOW CONFIRMATION
  // ============================================================

  nextSession.step = 'AWAITING_CONFIRMATION';

  return {
    reply:
      'Please review your booking details.',
    session: nextSession,
    showConfirmation: true
  };
};


export const handleChat = createChatHandler();