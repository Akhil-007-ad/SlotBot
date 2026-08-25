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

  participantsCollected: false,

  subject: null,

  description: null,

  /*
   * Used later for teammate conflict handling.
   */
  conflicts: [],

  suggestedSlot: null,

  suggestedRoomId: null

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


  /*
   * Old sessions may contain participants: []
   * without participantsCollected.
   *
   * Treat those as NOT answered.
   */
  if (
    typeof incoming.participantsCollected !==
    'boolean'
  ) {

    bookingData.participants = null;

    bookingData.participantsCollected =
      false;
  }


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
export const mergeBookingState = (
  state,
  extracted
) => {

  const merged = {
    ...state
  };


  for (
    const [field, value]
    of Object.entries(extracted || {})
  ) {

    if (
      value !== undefined &&
      value !== null
    ) {

      merged[field] = value;
    }
  }


  /*
   * Participants are special.
   *
   * We only consider the question answered
   * if extraction actually produced participants.
   */
  if (
    Object.prototype.hasOwnProperty.call(
      extracted || {},
      'participants'
    )
  ) {

    merged.participantsCollected =
      true;
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