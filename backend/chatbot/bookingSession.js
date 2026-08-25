const getToday = () => {

  const now = new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, '0'),
    String(
      now.getDate()
    ).padStart(2, '0')
  ].join('-');
};


export const emptyBookingState = () => ({

  attendeeCount: null,

  date: getToday(),

  startTime: null,

  endTime: null,

  tvRequired: null,

  selectedRoomId: null,

  selectedRoomName: null,

  /*
   * null = not answered yet
   * [] = user explicitly said none
   * [emails] = user provided teammates
   */
  participants: null,

  subject: null,

  description: null,

  /*
   * Used later for teammate conflict handling.
   */
  conflicts: null,

  suggestedBooking: null,

  forceBooking: false

});


export const createBookingSession = (
  session = {}
) => {

  const defaults =
    emptyBookingState();

  const incoming =
    session.bookingData || {};

  const bookingData = {
    ...defaults,
    ...incoming
  };


  return {

    step:
      session.step ||
      'COLLECTING_DETAILS',

    expectedField:
      session.expectedField ||
      null,

    bookingData

  };
};


/**
 * Merge extracted information into state.
 */
export const mergeBookingState = (state, extracted) => {
  const merged = { ...state };
  let invalidateRoom = false;
  let invalidateConflicts = false;
  const searchFields = ['attendeeCount', 'startTime', 'endTime', 'tvRequired'];

  for (const [field, value] of Object.entries(extracted || {})) {
    if (value === undefined || value === null) continue;

    const changed = JSON.stringify(merged[field]) !== JSON.stringify(value);

    if (searchFields.includes(field) && changed) invalidateRoom = true;
    if ((field === 'participants' || field === 'selectedRoomId') && changed) invalidateConflicts = true;

    merged[field] = value;
  }

  // Don't wipe a room the user just (re)named in this very message.
  if (invalidateRoom && extracted.selectedRoomId === undefined) {
    merged.selectedRoomId = null;
    merged.selectedRoomName = null;
    invalidateConflicts = true;
  }

  if (invalidateConflicts) {
    merged.conflicts = null;
    merged.suggestedBooking = null;
    merged.forceBooking = false;
  }

  return merged;
};
/**
 * Returns the first missing search field.
 */
export const getMissingSearchField = state => {

  const fields = [

    {
      field: 'attendeeCount',

      question:
        'How many people will be attending?'
    },

    {
      field: 'startTime',

      question:
        'What time should the meeting start?'
    },

    {
      field: 'endTime',

      question:
        'What time should the meeting end?'
    },

    {
      field: 'tvRequired',

      question:
        'Do you need a TV/display? Please answer yes or no.'
    }

  ];


  return (
    fields.find(
      item =>
        state[item.field] === null ||
        state[item.field] === undefined
    ) || null
  );
};


export const missingSearchFields = state => {

  const missing =
    getMissingSearchField(state);

  return missing
    ? [missing.question]
    : [];
};