const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const emptyBookingState = () => ({
  attendeeCount: null,
  // SlotBot only supports same-day bookings, so the date is always today.
  date: today(),
  startTime: null,
  endTime: null,
  tvRequired: null,
  selectedRoomId: null,
  selectedRoomName: null,
  participants: null,
  subject: null,
  description: null
});

export const createBookingSession = (session = {}) => ({
  step: session.step || 'COLLECTING_DETAILS',
  // A client can send null values for unfilled fields. Preserve the defaults
  // (especially today's date) instead of overwriting them with null.
  bookingData: mergeBookingState(emptyBookingState(), session.bookingData || {})
});

// Only defined extracted values replace the current state. This is the single
// merge point for every incoming message.
export const mergeBookingState = (state, extracted) => {
  const merged = { ...state };
  for (const [field, value] of Object.entries(extracted)) {
    if (value !== undefined && value !== null) merged[field] = value;
  }
  return merged;
};

export const missingSearchFields = state => [
  ['attendeeCount', 'How many people will be attending?'],
  ['startTime', 'What time should the meeting start?'],
  ['endTime', 'What time should the meeting end?'],
  ['tvRequired', 'Do you need a TV/display? Please answer yes or no.']
].filter(([field]) => state[field] === null).map(([, question]) => question);
