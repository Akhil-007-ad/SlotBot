import {
  getMissingSearchField
} from './bookingSession.js';
/* ============================================================
   STATES
============================================================ */
export const STATES = Object.freeze({

  COLLECTING_DETAILS:
    'COLLECTING_DETAILS',

  AWAITING_ROOM_SELECTION:
    'AWAITING_ROOM_SELECTION',

  AWAITING_PARTICIPANTS:
    'AWAITING_PARTICIPANTS',

  AWAITING_SUBJECT:
    'AWAITING_SUBJECT',

  AWAITING_DESCRIPTION:
    'AWAITING_DESCRIPTION',

  AWAITING_FINAL_CONFIRMATION:
    'AWAITING_FINAL_CONFIRMATION',

  AWAITING_CONFLICT_DECISION:
    'AWAITING_CONFLICT_DECISION',

  BOOKING:
    'BOOKING',

  COMPLETED:
    'COMPLETED',

  CANCELLED:
    'CANCELLED'
});


/* ============================================================
   EXPECTED FIELDS
============================================================ */

export const EXPECTED_FIELDS = Object.freeze({

  ATTENDEE_COUNT:
    'attendeeCount',

  START_TIME:
    'startTime',

  END_TIME:
    'endTime',

  TV_REQUIRED:
    'tvRequired',

  ROOM:
    'selectedRoomId',

  PARTICIPANTS:
    'participants',

  SUBJECT:
    'subject',

  DESCRIPTION:
    'description',

  CONFIRMATION:
    'confirmation',

  CONFLICT_DECISION:
    'conflictDecision'
});


/* ============================================================
   SEARCH-DETAIL TRANSITIONS
============================================================ */

/**
 * Determines the next piece of information required
 * before room search can happen.
 */
export const getNextSearchRequirement = state => {

  const missing =
    getMissingSearchField(state);

  if (!missing) {
    return null;
  }

  return {
    field:
      missing.field,

    question:
      missing.question
  };
};


/* ============================================================
   ROOM SEARCH
============================================================ */

/**
 * Once all room-search requirements are available,
 * the bot must search for rooms rather than ask another
 * question.
 */
export const shouldSearchRooms = state => {

  return (
    state.attendeeCount !== null &&
    state.attendeeCount !== undefined &&

    state.startTime !== null &&
    state.startTime !== undefined &&

    state.endTime !== null &&
    state.endTime !== undefined &&

    state.tvRequired !== null &&
    state.tvRequired !== undefined
  );
};


/* ============================================================
   PARTICIPANTS
============================================================ */

export const shouldAskParticipants = state => {

  return (
    shouldSearchRooms(state) &&
    Boolean(state.selectedRoomId) &&
    state.participants === null
  );
};


/* ============================================================
   SUBJECT
============================================================ */

export const shouldAskSubject = state => {

  return (
    Boolean(state.selectedRoomId) &&
    state.participants !== null &&
    (
      !state.subject ||
      !state.subject.trim()
    )
  );
};


export const shouldAskDescription = state => {

  return (
    Boolean(state.selectedRoomId) &&
    state.participants !== null &&
    Boolean(
      state.subject &&
      state.subject.trim()
    ) &&
    (
      state.description === null ||
      state.description === undefined
    )
  );
};


/* ============================================================
   FINAL CONFIRMATION
============================================================ */

export const shouldAskFinalConfirmation = state => {

  return (
    Boolean(state.selectedRoomId) &&

    state.participants !== null &&

    Boolean(
      state.subject &&
      state.subject.trim()
    ) &&

    state.description !== null &&
    state.description !== undefined
  );
};


/* ============================================================
   CONFLICT DECISION
============================================================ */

export const shouldAskConflictDecision = state => {

  return (
    Array.isArray(state.conflicts) &&
    state.conflicts.length > 0
  );
};


/* ============================================================
   NEXT STATE
============================================================ */

/**
 * Central decision function.
 *
 * This function DOES NOT perform database operations
 * or Microsoft Graph calls.
 *
 * It only decides what the conversation should do next.
 */
export const determineNextState = ({
  state,
  roomsAvailable = true
}) => {

  /* ----------------------------------------------------------
     1. SEARCH INFORMATION
  ---------------------------------------------------------- */

  const missing =
    getNextSearchRequirement(state);

  if (missing) {

    return {
      step:
        STATES.COLLECTING_DETAILS,

      expectedField:
        missing.field,

      question:
        missing.question,

      action:
        'ASK_QUESTION'
    };
  }


  /* ----------------------------------------------------------
     2. NO ROOMS
  ---------------------------------------------------------- */

  if (!roomsAvailable) {

    return {
      step:
        STATES.COLLECTING_DETAILS,

      expectedField:
        EXPECTED_FIELDS.START_TIME,

      action:
        'NO_ROOMS'
    };
  }


  /* ----------------------------------------------------------
     3. ROOM SELECTION
  ---------------------------------------------------------- */

  if (
    !state.selectedRoomId
  ) {

    return {
      step:
        STATES.AWAITING_ROOM_SELECTION,

      expectedField:
        EXPECTED_FIELDS.ROOM,

      action:
        'SHOW_ROOMS'
    };
  }


  /* ----------------------------------------------------------
     4. PARTICIPANTS
  ---------------------------------------------------------- */

  if (
    state.participants === null
  ) {

  return {
    step:
      STATES.AWAITING_PARTICIPANTS,

    expectedField:
      EXPECTED_FIELDS.PARTICIPANTS,

    action:
      'ASK_PARTICIPANTS'
  };
}


  /* ----------------------------------------------------------
     5. SUBJECT
  ---------------------------------------------------------- */

  if (
    !state.subject ||
    !state.subject.trim()
  ) {

    return {
      step:
        STATES.AWAITING_SUBJECT,

      expectedField:
        EXPECTED_FIELDS.SUBJECT,

      action:
        'ASK_SUBJECT'
    };
  }


  /* ----------------------------------------------------------
     6. DESCRIPTION
  ---------------------------------------------------------- */

  if (
    state.description === null ||
    state.description === undefined
  ) {

    return {
      step:
        STATES.AWAITING_DESCRIPTION,

      expectedField:
        EXPECTED_FIELDS.DESCRIPTION,

      action:
        'ASK_DESCRIPTION'
    };
  }


  /* ----------------------------------------------------------
     7. CONFLICTS
  ---------------------------------------------------------- */

  if (
    Array.isArray(state.conflicts) &&
    state.conflicts.length > 0
  ) {

    return {
      step:
        STATES.AWAITING_CONFLICT_DECISION,

      expectedField:
        EXPECTED_FIELDS.CONFLICT_DECISION,

      action:
        'SHOW_CONFLICT_OPTIONS'
    };
  }


  /* ----------------------------------------------------------
     8. FINAL CONFIRMATION
  ---------------------------------------------------------- */

  return {
    step:
      STATES.AWAITING_FINAL_CONFIRMATION,

    expectedField:
      EXPECTED_FIELDS.CONFIRMATION,

    action:
      'ASK_CONFIRMATION'
  };
};


/* ============================================================
   CONFLICT DECISIONS
============================================================ */

export const CONFLICT_ACTIONS = Object.freeze({

  CONFIRM_SUGGESTION:
    'CONFIRM_SUGGESTION',

  FORCE_BOOK:
    'FORCE_BOOK',

  CANCEL:
    'CANCEL'
});


export const parseConflictDecision = message => {

  const value =
    String(message || '')
      .trim()
      .toLowerCase()
      .replace(/[.!?,]/g, '')
      .replace(/\s+/g, ' ');


  /* ----------------------------------------------------------
     OPTION 1
  ---------------------------------------------------------- */

  if (
    /^(1|one)$/.test(value) ||
    /\b(confirm suggestion|confirm the suggestion|use suggestion|use the suggestion|use suggested time|use the suggested time|suggested slot|suggested time|book suggested)\b/i.test(value)
  ) {

    return CONFLICT_ACTIONS.CONFIRM_SUGGESTION;
  }


  /* ----------------------------------------------------------
     OPTION 2
  ---------------------------------------------------------- */

  if (
    /^(2|two)$/.test(value) ||
    /\b(force|force book|force booking|book anyway|book it anyway|book despite|ignore conflict|ignore conflicts|book regardless|book even though)\b/i.test(value)
  ) {

    return CONFLICT_ACTIONS.FORCE_BOOK;
  }


  /* ----------------------------------------------------------
     OPTION 3
  ---------------------------------------------------------- */

  if (
    /^(3|three)$/.test(value) ||
    /\b( cancel|cancel booking|don't book|do not book|stop)\b/i.test(value)
  ) {

    return CONFLICT_ACTIONS.CANCEL;
  }


  return null;
};


/* ============================================================
   CONFIRMATION
============================================================ */

export const parseConfirmation = message => {

  const value =
    String(message || '')
      .trim()
      .toLowerCase()
      .replace(/[.!?,]/g, '')
      .replace(/\s+/g, ' ');


  /* ----------------------------------------------------------
     YES
  ---------------------------------------------------------- */

  if (
    /^(yes|y|yeah|yea|yaa|yep|yup|sure|ok|okay|alright|confirm|confirmed|approve|approved)$/
      .test(value)
  ) {
    return true;
  }


  if (
    /\b(yes|yeah|yea|yaa|yep|yup|sure|go ahead|confirm|approve|book it|do it)\b/i.test(value)
  ) {
    return true;
  }


  /* ----------------------------------------------------------
     NO
  ---------------------------------------------------------- */

  if (
    /^(no|n|nope|nah|cancel|none)$/
      .test(value)
  ) {
    return false;
  }


  if (/\b(no|nope|nah|cancel|don't book|do not book)\b/i.test(value)) {
    return false;
  }


  return null;
};


/* ============================================================
   GENERIC STATE VALIDATION
============================================================ */

export const validateState = state => {

  const errors = [];


  if (
    state.attendeeCount !== null &&
    (
      !Number.isInteger(
        state.attendeeCount
      ) ||
      state.attendeeCount < 1
    )
  ) {

    errors.push({
      field:
        EXPECTED_FIELDS.ATTENDEE_COUNT,

      message:
        'Attendee count must be at least 1.'
    });
  }


  if (
    !state.date
  ) {

    errors.push({
      field:
        'date',

      message:
        'Booking date is required.'
    });
  }


  if (
    state.tvRequired !== null &&
    typeof state.tvRequired !== 'boolean'
  ) {

    errors.push({
      field:
        EXPECTED_FIELDS.TV_REQUIRED,

      message:
        'TV requirement must be yes or no.'
    });
  }


  return errors;
};
