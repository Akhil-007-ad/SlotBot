import {
  createBooking,
  findOverlappingBooking
} from '../services/bookingService.js';

import {
  checkRoomAvailability,
  createRoomBookingEvent,
  isMS365Enabled
} from '../services/graphService.js';

import {
  getChatRooms
} from '../services/roomService.js';

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


export const fetchRooms = getChatRooms;


/* ============================================================
   DATE / TIME HELPERS
============================================================ */

const getToday = () => {

  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
};


const formatTime = value => {

  if (!value) {
    return '';
  }

  const normalized =
    String(value);

  const date =
    new Date(
      `2000-01-01T${normalized}`
    );

  if (
    Number.isNaN(date.getTime())
  ) {
    return normalized;
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }
  );
};


const formatDateTime = date => {

  if (!date) {
    return '';
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }
  );
};


/* ============================================================
   ROOM DTO
============================================================ */

const roomDto = room => ({
  id:
    room.id ||
    room._id?.toString() ||
    room.name,

  name:
    room.name,

  capacity:
    room.capacity,

  hasTv:
    Boolean(
      room.tvAvailability
    ),

  location:
    [
      room.floor,
      room.location
    ]
      .filter(Boolean)
      .join(' · ')
});


/* ============================================================
   SESSION HELPERS
============================================================ */

const resetSession = () => ({
  step:
    'COLLECTING_DETAILS',

  expectedField:
    'attendeeCount',

  bookingData:
    {
      ...emptyBookingState()
    }
});


const ensureTodaySession = session => {

  const nextSession =
    createBookingSession(session);

  const today =
    getToday();

  if (
    !nextSession.bookingData
  ) {

    nextSession.bookingData =
      emptyBookingState();
  }

  /*
   * SlotBot is today-only.
   */
  nextSession.bookingData.date =
    today;

  return nextSession;
};


/* ============================================================
   NORMALIZATION
============================================================ */

const normalizeMessage = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[.!?,]/g, '')
    .replace(/\s+/g, ' ');


/* ============================================================
   GLOBAL INTENTS
============================================================ */

const isCancelMessage = message => {

  const value =
    normalizeMessage(message);

  return (
    /^(cancel|cancel it|cancel this|restart|reset|start over|quit)$/
      .test(value) ||
    /\b(cancel|cancel it|don't book|do not book)\b/
      .test(value)
  );
};


const isConfirmationMessage = message => {

  const value =
    normalizeMessage(message);

  if (
    /^(yes|y|yeah|yea|yaa|yep|yup|sure|ok|okay|alright|confirm|confirmed|approve|approved|go ahead|book it|do it)$/
      .test(value)
  ) {
    return true;
  }

  if ( /\b(yes|yeah|yea|yaa|yep|yup|sure|go ahead|confirm|approve|book it)\b/i.test(value)
  ) {
    return true;
  }

  return false;
};


const isNegativeConfirmation = message => {

  const value =
    normalizeMessage(message);

  if (
    /^(no|n|nope|nah|cancel|cancel it|don't|dont|none)$/
      .test(value)
  ) {
    return true;
  }

  return false;
};


/* ============================================================
   CONFLICT DECISION
============================================================ */

const parseConflictDecision = message => {

  const value =
    normalizeMessage(message);


  /*
   * OPTION 1:
   * Confirm suggested alternative.
   */
  if (
    /^(1|one)$/.test(value) ||
    /\b(use the suggestion|use suggestion|confirm suggestion|confirm the suggestion|suggested time|suggested slot|book the suggested|use that time|use that slot)\b/i.test(value)
  ) {

    return 'CONFIRM_SUGGESTION';
  }


  /*
   * OPTION 2:
   * Force book despite conflicts.
   */
  if (
    /^(2|two)$/.test(value) ||
    /\b(force|force book|force booking|book anyway|book despite|ignore the conflict|ignore conflicts|book even though|book regardless)\b/i.test(value)
  ) {

    return 'FORCE_BOOK';
  }


  /*
   * OPTION 3:
   * Cancel.
   */
  if (
    /^(3|three)$/.test(value) ||
    /\b(cancel|cancel booking|don't book|do not book)\b/i.test(value)
  ) {

    return 'CANCEL';
  }


  return null;
};


/* ============================================================
   ROOM RANKING
============================================================ */

const rankRooms = (
  rooms,
  attendeeCount
) => {

  return [...rooms].sort(
    (a, b) => {

      const aCapacity =
        Number(a.capacity || 0);

      const bCapacity =
        Number(b.capacity || 0);


      /*
       * Prefer the smallest room that can fit everyone.
       */
      const aExcess =
        aCapacity -
        attendeeCount;

      const bExcess =
        bCapacity -
        attendeeCount;


      /*
       * If both fit, smaller excess wins.
       */
      if (
        aExcess >= 0 &&
        bExcess >= 0
      ) {
        return (
          aExcess -
          bExcess
        );
      }


      /*
       * If only one fits, prefer it.
       */
      if (
        aExcess >= 0
      ) {
        return -1;
      }

      if (
        bExcess >= 0
      ) {
        return 1;
      }


      return (
        aCapacity -
        bCapacity
      );
    }
  );
};


/* ============================================================
   SEARCH ROOMS
============================================================ */

const searchRooms = async (
  rooms,
  state,
  findOverlap
) => {

  const start =
    toLocalDateTime(
      state.date,
      state.startTime
    );

  const end =
    toLocalDateTime(
      state.date,
      state.endTime
    );

  if (
    !start ||
    !end
  ) {
    return [];
  }


  const durationHours =
    (end.getTime() -
      start.getTime()) /
    36e5;


  if (
    durationHours <= 0
  ) {
    return [];
  }


  const availableRooms = [];


  for (
    const room of rooms
  ) {

    const capacity =
      Number(
        room.capacity || 0
      );


    /*
     * Capacity.
     */
    if (
      capacity <
      Number(state.attendeeCount)
    ) {
      continue;
    }


    /*
     * TV.
     */
    if (
      state.tvRequired === true &&
      !room.tvAvailability
    ) {
      continue;
    }


    /*
     * Minimum duration.
     */
    if (
      room.minBookingHours != null &&
      durationHours <
        Number(room.minBookingHours)
    ) {
      continue;
    }


    /*
     * Maximum duration.
     */
    if (
      room.maxBookingHours != null &&
      durationHours >
        Number(room.maxBookingHours)
    ) {
      continue;
    }


    /*
     * Internal database overlap.
     */
    const overlaps =
      await findOverlap(
        room.name,
        start,
        end
      );

    if (overlaps) {
      continue;
    }


    availableRooms.push(room);
  }


  return rankRooms(
    availableRooms,
    Number(state.attendeeCount)
  );
};


/* ============================================================
   VALIDATE TIME
============================================================ */

const isFutureTodayTime = (
  date,
  time
) => {

  const dateTime =
    toLocalDateTime(
      date,
      time
    );

  if (!dateTime) {
    return false;
  }

  return (
    dateTime.getTime() >
    Date.now()
  );
};


/* ============================================================
   PARTICIPANT CONFLICT CHECK
============================================================ */

/**
 * The default checkCalendar dependency is used here for
 * teammate calendars as well.
 *
 * If your graphService has a dedicated function for users,
 * inject it through createChatHandler:
 *
 * checkParticipantCalendar(email, start, end, accessToken)
 */
const checkParticipantConflicts = async ({
  participants,
  startTime,
  endTime,
  accessToken,
  checkParticipantCalendar
}) => {

  const conflicts = [];


  if (
    !participants ||
    !participants.length
  ) {
    return conflicts;
  }


  for (
    const email of participants
  ) {

    try {

      const free =
        await checkParticipantCalendar(
          email,
          startTime,
          endTime,
          accessToken
        );


      if (!free) {

        conflicts.push({
          email,
          startTime,
          endTime
        });
      }

    } catch (error) {

      console.error(
        `Calendar check failed for ${email}:`,
        error.message
      );


      /*
       * Treat a failed calendar check as a conflict
       * rather than blindly scheduling the meeting.
       */
      conflicts.push({
        email,
        startTime,
        endTime,
        reason:
          'Unable to verify calendar availability'
      });
    }
  }


  return conflicts;
};


/* ============================================================
   FIND NEAREST ALTERNATIVE
============================================================ */

const findNearestAlternative = async ({
  rooms,
  state,
  findOverlap,
  checkRoomCalendar,
  checkParticipantCalendar,
  accessToken
}) => {

  const requestedStart =
    toLocalDateTime(
      state.date,
      state.startTime
    );

  const requestedEnd =
    toLocalDateTime(
      state.date,
      state.endTime
    );

  if (
    !requestedStart ||
    !requestedEnd
  ) {
    return null;
  }


  const durationMs =
    requestedEnd.getTime() -
    requestedStart.getTime();


  if (
    durationMs <= 0
  ) {
    return null;
  }


  /*
   * Start searching immediately after the
   * originally requested end time.
   *
   * 15-minute increments.
   */
  let candidateStart =
    new Date(
      requestedEnd.getTime()
    );


  const latestEnd =
    new Date(
      `${state.date}T23:59:00`
    );


  while (true) {

    const candidateEnd =
      new Date(
        candidateStart.getTime() +
        durationMs
      );


    /*
     * Cannot go beyond today.
     */
    if (
      candidateEnd >
      latestEnd
    ) {
      break;
    }


    const candidateState = {
      ...state,

      startTime:
        `${String(candidateStart.getHours()).padStart(2, '0')}:${String(candidateStart.getMinutes()).padStart(2, '0')}`,

      endTime:
        `${String(candidateEnd.getHours()).padStart(2, '0')}:${String(candidateEnd.getMinutes()).padStart(2, '0')}`
    };


    /*
     * Find internally available rooms.
     */
    const availableRooms =
      await searchRooms(
        rooms,
        candidateState,
        findOverlap
      );


    for (
      const room of availableRooms
    ) {

      /*
       * Verify room's Microsoft 365 calendar.
       */
      if (
        isMS365Enabled() &&
        room.outlookEmail
      ) {

        const roomFree =
          await checkRoomCalendar(
            room.outlookEmail,
            candidateStart,
            candidateEnd,
            accessToken
          );

        if (!roomFree) {
          continue;
        }
      }


      /*
       * Verify all teammates.
       */
      const conflicts =
        await checkParticipantConflicts({
          participants:
            state.participants || [],

          startTime:
            candidateStart,

          endTime:
            candidateEnd,

          accessToken,

          checkParticipantCalendar
        });


      if (
        conflicts.length === 0
      ) {

        return {
          date: state.date,

          startTime:
            candidateState.startTime,

          endTime:
            candidateState.endTime,

          roomId:
            room.id ||
            room._id?.toString() ||
            room.name,

          roomName:
            room.name,

          room
        };
      }
    }


    /*
     * Move forward by 15 minutes.
     */
    candidateStart =
      new Date(
        candidateStart.getTime() +
        15 * 60 * 1000
      );
  }


  return null;
};


/* ============================================================
   MAIN CHAT HANDLER
============================================================ */

export const createChatHandler = ({
  getRooms = fetchRooms,

  findOverlap =
    findOverlappingBooking,

  saveBooking =
    createBooking,

  isCalendarEnabled =
    isMS365Enabled,

  checkCalendar =
    checkRoomAvailability,

  createCalendarEvent =
    createRoomBookingEvent,

  /*
   * By default we use the same calendar availability
   * function for teammates.
   *
   * You can replace this with a dedicated Graph function.
   */
  checkParticipantCalendar =
    checkRoomAvailability

} = {}) => async (
  message,
  session,
  user
) => {


  /* ==========================================================
     BASIC SETUP
  ========================================================== */

  const cleanMessage =
    String(message || '')
      .trim();

  const lower =
    normalizeMessage(cleanMessage);

  const nextSession =
    ensureTodaySession(session);

  const state =
    nextSession.bookingData;

  const today =
    getToday();


  if (!cleanMessage) {

    return {
      reply:
        'Please provide the booking details.',
      session: nextSession
    };
  }


  /* ==========================================================
     GLOBAL CANCEL
  ========================================================== */

  if (
    isCancelMessage(cleanMessage)
  ) {

    return {
      reply:
        'Booking cancelled. Start a new request whenever you are ready.',

      session:
        resetSession()
    };
  }


  /* ==========================================================
     LOAD ROOMS
  ========================================================== */

  const rooms =
    await getRooms(user);


  if (
    !Array.isArray(rooms) ||
    rooms.length === 0
  ) {

    return {
      reply:
        'I could not find any configured meeting rooms right now. Please try again later.',

      session:
        nextSession
    };
  }


  /* ==========================================================
     CONFLICT DECISION
  ========================================================== */

  if (
    nextSession.step ===
    'AWAITING_CONFLICT_DECISION'
  ) {

    const decision =
      parseConflictDecision(
        cleanMessage
      );


    if (
      decision === 'CANCEL'
    ) {

      return {
        reply:
          'Booking cancelled.',

        session:
          resetSession()
      };
    }


    /*
     * OPTION 1:
     * Confirm suggested alternative.
     */
    if (
      decision ===
      'CONFIRM_SUGGESTION'
    ) {

      const suggestion =
        state.suggestedBooking;


      if (!suggestion) {

        nextSession.step =
          'AWAITING_FINAL_CONFIRMATION';

        return {
          reply:
            'The suggested booking is no longer available. Please confirm whether you want to continue with the original booking.',

          session:
            nextSession
        };
      }


      /*
       * Apply suggestion.
       */
      state.date =
        suggestion.date;

      state.startTime =
        suggestion.startTime;

      state.endTime =
        suggestion.endTime;

      state.selectedRoomId =
        suggestion.roomId;

      state.selectedRoomName =
        suggestion.roomName;


      nextSession.step =
        'AWAITING_FINAL_CONFIRMATION';

      nextSession.expectedField =
        null;


      return {
        reply:
          `The suggested slot is **${suggestion.roomName}**, today from **${formatTime(suggestion.startTime)}** to **${formatTime(suggestion.endTime)}**. Would you like me to confirm this booking?`,

        session:
          nextSession
      };
    }


    /*
     * OPTION 2:
     * Force booking despite teammate conflict.
     */
    if (
      decision ===
      'FORCE_BOOK'
    ) {

      state.suggestedBooking =
        null;

      /*
       * Continue directly into final booking validation.
       */
      nextSession.step =
        'AWAITING_FINAL_CONFIRMATION';

      nextSession.expectedField =
        null;

      nextSession.forceBook =
        true;


      return {
        reply:
          'Understood. I will force the booking despite the teammate calendar conflicts. Please confirm the booking.',

        session:
          nextSession
      };
    }


    return {
      reply:
        `Please choose one of these options:

1. **Confirm with suggestion**
2. **Force book despite teammate conflicts**
3. **Cancel**`,

      session:
        nextSession
    };
  }


  /* ==========================================================
     EXPLICIT FINAL CONFIRMATION
  ========================================================== */

  if (
    nextSession.step ===
    'AWAITING_FINAL_CONFIRMATION'
  ) {

    if (
      isNegativeConfirmation(
        cleanMessage
      )
    ) {

      return {
        reply:
          'Booking cancelled.',

        session:
          resetSession()
      };
    }


    if (
      isConfirmationMessage(
        cleanMessage
      )
    ) {

      /*
       * If user was forced-booking, skip participant
       * conflict blocking but still verify the room.
       */
      const forceBook =
        Boolean(
          nextSession.forceBook
        );


      const room =
        rooms.find(
          item =>
            (
              item.id ===
              state.selectedRoomId
            ) ||
            (
              item._id?.toString() ===
              String(state.selectedRoomId)
            ) ||
            (
              item.name ===
              state.selectedRoomId
            )
        );


      const startTime =
        toLocalDateTime(
          state.date,
          state.startTime
        );

      const endTime =
        toLocalDateTime(
          state.date,
          state.endTime
        );


      if (
        !room ||
        !startTime ||
        !endTime
      ) {

        nextSession.step =
          'COLLECTING_DETAILS';

        nextSession.expectedField =
          'startTime';

        return {
          reply:
            'Some booking information is missing. Please provide the meeting timing again.',

          session:
            nextSession
        };
      }


      /*
       * Start time must still be in the future.
       */
      if (
        startTime.getTime() <=
        Date.now()
      ) {

        state.startTime =
          null;

        state.endTime =
          null;

        state.selectedRoomId =
          null;

        state.selectedRoomName =
          null;

        nextSession.step =
          'COLLECTING_DETAILS';

        nextSession.expectedField =
          'startTime';

        return {
          reply:
            '⚠️ That meeting time has already started or passed. Please choose a future time today.',

          session:
            nextSession
        };
      }


      /*
       * End must be after start.
       */
      if (
        endTime <= startTime
      ) {

        state.endTime =
          null;

        state.selectedRoomId =
          null;

        state.selectedRoomName =
          null;

        nextSession.step =
          'COLLECTING_DETAILS';

        nextSession.expectedField =
          'endTime';

        return {
          reply:
            'The end time must be after the start time. What time should the meeting end?',

          session:
            nextSession
        };
      }


      /* ------------------------------------------------------
         FINAL DB ROOM CHECK
      ------------------------------------------------------ */

      const dbOverlap =
        await findOverlap(
          room.name,
          startTime,
          endTime
        );


      if (
        dbOverlap
      ) {

        state.selectedRoomId =
          null;

        state.selectedRoomName =
          null;

        nextSession.step =
          'AWAITING_ROOM_SELECTION';

        nextSession.expectedField =
          'selectedRoomId';

        return {
          reply:
            `❌ **${room.name}** was just booked for that time. Please select another available room.`,

          session:
            nextSession,

          roomsList:
            (
              await searchRooms(
                rooms,
                state,
                findOverlap
              )
            ).map(roomDto)
        };
      }


      /* ------------------------------------------------------
         FINAL MS365 ROOM CHECK
      ------------------------------------------------------ */

      if (
        isCalendarEnabled() &&
        room.outlookEmail
      ) {

        const roomFree =
          await checkCalendar(
            room.outlookEmail,
            startTime,
            endTime,
            user?.accessToken
          );


        if (
          !roomFree
        ) {

          state.selectedRoomId =
            null;

          state.selectedRoomName =
            null;

          nextSession.step =
            'AWAITING_ROOM_SELECTION';

          nextSession.expectedField =
            'selectedRoomId';

          return {
            reply:
              `❌ **${room.name}** is no longer available during that time. Please select another room.`,

            session:
              nextSession,

            roomsList:
              (
                await searchRooms(
                  rooms,
                  state,
                  findOverlap
                )
              ).map(roomDto)
          };
        }
      }


      /* ------------------------------------------------------
         FINAL TEAMMATE CHECK
      ------------------------------------------------------ */

      if (
        !forceBook
      ) {

        const conflicts =
          await checkParticipantConflicts({
            participants:
              state.participants || [],

            startTime,
            endTime,

            accessToken:
              user?.accessToken,

            checkParticipantCalendar
          });


        if (
          conflicts.length > 0
        ) {

          state.conflicts =
            conflicts;


          const suggestion =
            await findNearestAlternative({
              rooms,

              state,

              findOverlap,

              checkRoomCalendar:
                checkCalendar,

              checkParticipantCalendar,

              accessToken:
                user?.accessToken
            });


          state.suggestedBooking =
            suggestion;


          nextSession.step =
            'AWAITING_CONFLICT_DECISION';

          nextSession.expectedField =
            null;


          if (suggestion) {

            return {
              reply:
                `⚠️ Some teammates have calendar conflicts.

${conflicts.map(item => `• **${item.email}**`).join('\n')}

I found the nearest conflict-free option:

🏢 **${suggestion.roomName}**
🕒 **${formatTime(suggestion.startTime)} – ${formatTime(suggestion.endTime)}**

What would you like to do?

**1. Confirm with suggestion**
**2. Force book despite teammate conflicts**
**3. Cancel**`,

              session:
                nextSession,

              suggestedBooking: {
                ...suggestion
              },

              conflicts
            };
          }


          return {
            reply:
              `⚠️ Some teammates have calendar conflicts:

${conflicts.map(item => `• **${item.email}**`).join('\n')}

I could not find another conflict-free slot later today.

What would you like to do?

**1. Confirm with suggestion**
**2. Force book despite teammate conflicts**
**3. Cancel**`,

            session:
              nextSession,

            conflicts
          };
        }
      }


      /* ------------------------------------------------------
         CREATE DATABASE BOOKING
      ------------------------------------------------------ */

      const booking =
        await saveBooking(
          {
            roomName:
              room.name,

            peopleCount:
              state.attendeeCount,

            startTime,
            endTime,

            date:
              toLocalDateTime(
                today,
                '00:00'
              ),

            teammates:
              state.participants || [],

            subject:
              state.subject,

            description:
              state.description
          },

          user
        );


      /* ------------------------------------------------------
         MICROSOFT 365 EVENT
      ------------------------------------------------------ */

      let teamsLink =
        null;


      if (
        isCalendarEnabled() &&
        room.outlookEmail &&
        user?.accessToken
      ) {

        try {

          const graphResult =
            await createCalendarEvent({
              userAccessToken:
                user.accessToken,

              roomName:
                room.name,

              outlookEmail:
                room.outlookEmail,

              startTime,
              endTime,

              peopleCount:
                state.attendeeCount,

              teammates:
                state.participants || [],

              meetingTitle:
                state.subject,

              description:
                state.description
            });


          if (
            graphResult
          ) {

            booking.outlookEventId =
              graphResult.outlookEventId;

            booking.teamsLink =
              graphResult.teamsLink;

            await booking.save();

            teamsLink =
              graphResult.teamsLink;
          }

        } catch (error) {

          /*
           * DB booking has already been created.
           * Keep it and report Graph failure in server logs.
           */
          console.error(
            'Microsoft 365 sync failed:',
            error.message
          );
        }
      }


      return {
        reply:
          `🎉 **Success!**

**Room:** ${room.name}
**Time:** ${formatTime(state.startTime)} – ${formatTime(state.endTime)}
**People:** ${state.attendeeCount}
**TV:** ${state.tvRequired ? 'Yes' : 'No'}

Your booking has been confirmed.`,

        session:
          resetSession(),

        bookingConfirmed:
          true,

        teamsLink
      };
    }


    return {
      reply:
        'Please answer yes to confirm the booking, or no to cancel it.',

      session:
        nextSession
    };
  }


  /* ==========================================================
     GENERAL EXTRACTION
  ========================================================== */

  const extracted = extractBookingDetails(
  cleanMessage,
  rooms,
  nextSession.bookingData,
  nextSession.expectedField
);


  /* ==========================================================
     DATE VALIDATION
  ========================================================== */

  if (
    extracted.date &&
    extracted.date !== today
  ) {

    state.date =
      today;


    nextSession.step =
      'COLLECTING_DETAILS';

    nextSession.expectedField =
      'startTime';


    return {
      reply:
        '⚠️ SlotBot currently supports bookings only for the remaining time slots today. Please provide a future time for today.',

      session:
        nextSession
    };
  }


  /*
   * Date is always today.
   */
  state.date =
    today;


  /* ==========================================================
     TRACK WHETHER SEARCH CRITERIA CHANGED
  ========================================================== */

  const searchCriteriaChanged =
    extracted.attendeeCount !== undefined ||
    extracted.startTime !== undefined ||
    extracted.endTime !== undefined ||
    extracted.tvRequired !== undefined;


  /*
   * If search criteria changed but a new room wasn't explicitly
   * selected in the same message, the old room is no longer valid.
   */
  if (
    searchCriteriaChanged &&
    extracted.selectedRoomId === undefined
  ) {

    state.selectedRoomId =
      null;

    state.selectedRoomName =
      null;
  }


  /* ==========================================================
     MERGE EVERYTHING
  ========================================================== */

  nextSession.bookingData =
    mergeBookingState(
      state,
      extracted
    );


  /*
   * Refresh reference because merge returns a new object.
   */
  const current =
    nextSession.bookingData;


  /* ==========================================================
     ATTENDEE VALIDATION
  ========================================================== */

  if (
    current.attendeeCount !== null &&
    current.attendeeCount !== undefined
  ) {

    if (
      !Number.isInteger(
        current.attendeeCount
      ) ||
      current.attendeeCount < 1
    ) {

      current.attendeeCount =
        null;

      current.selectedRoomId =
        null;

      current.selectedRoomName =
        null;

      nextSession.step =
        'COLLECTING_DETAILS';

      nextSession.expectedField =
        'attendeeCount';

      return {
        reply:
          'Please provide an attendee count of at least 1.',

        session:
          nextSession
      };
    }


    const maxCapacity =
      rooms.reduce(
        (
          max,
          room
        ) =>
          Math.max(
            max,
            Number(
              room.capacity || 0
            )
          ),
        0
      );


    if (
      current.attendeeCount >
      maxCapacity
    ) {

      current.attendeeCount =
        null;

      current.selectedRoomId =
        null;

      current.selectedRoomName =
        null;

      nextSession.step =
        'COLLECTING_DETAILS';

      nextSession.expectedField =
        'attendeeCount';

      return {
        reply:
          `Our largest room seats ${maxCapacity}. How many people will attend?`,

        session:
          nextSession
      };
    }
  }


  /* ==========================================================
     TIME VALIDATION
  ========================================================== */

  if (
    current.startTime &&
    current.endTime
  ) {

    const start =
      toLocalDateTime(
        today,
        current.startTime
      );

    const end =
      toLocalDateTime(
        today,
        current.endTime
      );


    if (
      !start ||
      !end
    ) {

      current.startTime =
        null;

      current.endTime =
        null;

      current.selectedRoomId =
        null;

      current.selectedRoomName =
        null;

      nextSession.step =
        'COLLECTING_DETAILS';

      nextSession.expectedField =
        'startTime';

      return {
        reply:
          'I could not understand the meeting time. What time should it start?',

        session:
          nextSession
      };
    }


    if (
      end <= start
    ) {

      current.endTime =
        null;

      current.selectedRoomId =
        null;

      current.selectedRoomName =
        null;

      nextSession.step =
        'COLLECTING_DETAILS';

      nextSession.expectedField =
        'endTime';

      return {
        reply:
          'The end time must be after the start time. What time should the meeting end?',

        session:
          nextSession
      };
    }
  }


  /* ==========================================================
     START TIME MUST BE FUTURE
  ========================================================== */

  if (
    current.startTime &&
    !isFutureTodayTime(
      today,
      current.startTime
    )
  ) {

    current.startTime =
      null;

    current.endTime =
      null;

    current.selectedRoomId =
      null;

    current.selectedRoomName =
      null;

    nextSession.step =
      'COLLECTING_DETAILS';

    nextSession.expectedField =
      'startTime';

    return {
      reply:
        '⚠️ Please choose a start time later than the current time. SlotBot only allows future bookings for today.',

      session:
        nextSession
    };
  }


  /* ==========================================================
     FIND MISSING SEARCH INFORMATION
  ========================================================== */

  const missing =
    getMissingSearchField(
      current
    );


  if (
    missing
  ) {

    nextSession.step =
      'COLLECTING_DETAILS';

    nextSession.expectedField =
      missing.field;


    return {
      reply:
        missing.question,

      session:
        nextSession
    };
  }


  /* ==========================================================
     SEARCH ROOMS
  ========================================================== */

  const availableRooms =
    await searchRooms(
      rooms,
      current,
      findOverlap
    );


  if (
    availableRooms.length === 0
  ) {

    current.selectedRoomId =
      null;

    current.selectedRoomName =
      null;

    nextSession.step =
      'COLLECTING_DETAILS';


    /*
     * Ask the user to alter timing first.
     */
    nextSession.expectedField =
      'startTime';


    return {
      reply:
        `No rooms are available today for **${current.attendeeCount} people** from **${formatTime(current.startTime)}** to **${formatTime(current.endTime)}**${current.tvRequired ? ' with a TV' : ''}.

Please provide another start time.`,

      session:
        nextSession
    };
  }


  /* ==========================================================
     ROOM SELECTION
  ========================================================== */

  const selectedRoom =
    availableRooms.find(
      room =>
        room.id ===
        current.selectedRoomId ||
        room._id?.toString() ===
        String(current.selectedRoomId) ||
        room.name ===
        current.selectedRoomId
    );


  /*
   * No valid room selected.
   * Return ranked room cards.
   */
  if (
    !selectedRoom
  ) {

    current.selectedRoomId =
      null;

    current.selectedRoomName =
      null;

    nextSession.step =
      'AWAITING_ROOM_SELECTION';

    nextSession.expectedField =
      'selectedRoomId';


    return {
      reply:
        'I found these rooms that best match your requirements. Please select one:',

      session:
        nextSession,

      roomsList:
        availableRooms.map(roomDto)
    };
  }


  /*
   * Keep room name synchronized.
   */
  current.selectedRoomName =
    selectedRoom.name;


  /* ==========================================================
     PARTICIPANTS
  ========================================================== */

  if (
    current.participants === null ||
    current.participants === undefined
  ) {

    nextSession.step =
      'AWAITING_PARTICIPANTS';

    nextSession.expectedField =
      'participants';


    return {
      reply:
        'Who should receive the meeting invitation? Enter teammate email addresses separated by commas, or type **none**.',

      session:
        nextSession,

      selectedRoom:
        roomDto(selectedRoom)
    };
  }


  /* ==========================================================
     SUBJECT
  ========================================================== */

  if (
    current.subject === null ||
    current.subject === undefined ||
    current.subject.trim() === ''
  ) {

    nextSession.step =
      'AWAITING_SUBJECT';

    nextSession.expectedField =
      'subject';


    return {
      reply:
        'What should the meeting invitation title be? For example: **Sprint planning**.',

      session:
        nextSession
    };
  }


  /* ==========================================================
     DESCRIPTION
  ========================================================== */

  if (
    current.description === null ||
    current.description === undefined
  ) {

    nextSession.step =
      'AWAITING_DESCRIPTION';

    nextSession.expectedField =
      'description';


    return {
      reply:
        'Please provide the meeting description or agenda. Type **none** to leave it blank.',

      session:
        nextSession
    };
  }


  /* ==========================================================
     TEAMMATE CONFLICT CHECK
  ========================================================== */

  const startTime =
    toLocalDateTime(
      today,
      current.startTime
    );

  const endTime =
    toLocalDateTime(
      today,
      current.endTime
    );


  const conflicts =
    await checkParticipantConflicts({
      participants:
        current.participants || [],

      startTime,
      endTime,

      accessToken:
        user?.accessToken,

      checkParticipantCalendar
    });


  current.conflicts =
    conflicts;


  /* ==========================================================
     NO CONFLICT
  ========================================================== */

  if (
    conflicts.length === 0
  ) {

    nextSession.step =
      'AWAITING_FINAL_CONFIRMATION';

    nextSession.expectedField =
      null;


    return {
      reply:
        `✅ Everything looks good.

**Room:** ${selectedRoom.name}
**Time:** ${formatTime(current.startTime)} – ${formatTime(current.endTime)}
**People:** ${current.attendeeCount}
**TV:** ${current.tvRequired ? 'Yes' : 'No'}
**Teammates:** ${
          current.participants.length
            ? current.participants.join(', ')
            : 'None'
        }
**Subject:** ${current.subject}

Would you like me to confirm this booking?`,

      session:
        nextSession,

      showConfirmation:
        true
    };
  }


  /* ==========================================================
     CONFLICT FOUND
  ========================================================== */

  const suggestion =
    await findNearestAlternative({
      rooms,

      state: current,

      findOverlap,

      checkRoomCalendar:
        checkCalendar,

      checkParticipantCalendar,

      accessToken:
        user?.accessToken
    });


  current.suggestedBooking =
    suggestion;


  nextSession.step =
    'AWAITING_CONFLICT_DECISION';

  nextSession.expectedField =
    null;


  if (
    suggestion
  ) {

    return {
      reply:
        `⚠️ Some teammates have calendar conflicts:

${conflicts.map(
          item =>
            `• **${item.email}**`
        ).join('\n')}

I found the nearest conflict-free option:

🏢 **${suggestion.roomName}**
🕒 **${formatTime(suggestion.startTime)} – ${formatTime(suggestion.endTime)}**

What would you like to do?

**1. Confirm with suggestion**
**2. Force book despite teammate conflicts**
**3. Cancel**`,

      session:
        nextSession,

      conflicts,

      suggestedBooking:
        suggestion
    };
  }


  return {
    reply:
      `⚠️ Some teammates have calendar conflicts:

${conflicts.map(
        item =>
          `• **${item.email}**`
      ).join('\n')}

I could not find another conflict-free slot later today.

What would you like to do?

**1. Confirm with suggestion**
**2. Force book despite teammate conflicts**
**3. Cancel**`,

    session:
      nextSession,

    conflicts
  };
};


/* ============================================================
   DEFAULT HANDLER
============================================================ */

export const handleChat =
  createChatHandler();