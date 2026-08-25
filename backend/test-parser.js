import { extractBookingDetails } from './chatbot/extraction.js';
import { createChatHandler } from './chatbot/chatHandler.js';

let failed = 0;
const assert = (condition, message) => { if (!condition) { console.error(`FAIL: ${message}`); failed++; } };

// Mock Date.now so future time checks pass for 10 AM.
const originalNow = Date.now;
Date.now = () => new Date().setHours(1, 0, 0, 0);

// Extraction regression tests: wording may vary, but every supplied slot must be read.
const extracted = extractBookingDetails('Book a room for 6 members with TV availability from 10 to 11');
assert(extracted.attendeeCount === 6, 'attendee count: "6 members"');
assert(extracted.tvRequired === true, 'TV availability');
assert(extracted.startTime === '10:00' && extracted.endTime === '11:00', 'bare time range');

const rooms = [
  { id: 'galaxy', name: 'Galaxy', capacity: 8, tvAvailability: true, minBookingHours: 0.5, maxBookingHours: 2, floor: '4th floor', location: 'Hyderabad', outlookEmail: null },
  { id: 'vista', name: 'Vista', capacity: 6, tvAvailability: false, minBookingHours: 0.5, maxBookingHours: 2, floor: '4th floor', location: 'Hyderabad', outlookEmail: null }
];
let savedBooking;
const chat = createChatHandler({
  getRooms: async () => rooms,
  findOverlap: async () => null,
  isCalendarEnabled: () => false,
  checkParticipantCalendar: async () => true,
  saveBooking: async details => { savedBooking = details; return { save: async () => {} }; }
});
const user = { id: 'test-user', email: 'organizer@techwave.com', name: 'Test User' };
let session = undefined;
const send = async message => { const result = await chat(message, session, user); session = result.session; return result; };

let result = await send('Book a room for 6 members with TV availability from 10 to 11');
assert(result.roomsList?.length === 1 && result.roomsList[0].name === 'Galaxy', 'search filters TV and returns only eligible room cards');
assert(session.step === 'AWAITING_ROOM_SELECTION', 'room-selection state');
result = await send('Galaxy');
assert(session.step === 'AWAITING_PARTICIPANTS', 'ask for invitees after room selection');
result = await send('alex@techwave.com, sam@techwave.com');
assert(session.step === 'AWAITING_SUBJECT', 'ask for invitation title after invitees');
result = await send('Sprint planning');
assert(session.step === 'AWAITING_DESCRIPTION', 'ask for description after title');
result = await send('Plan the next sprint and assign owners.');
console.log("STEP AFTER DESCRIPTION:", session.step);
assert(session.step === 'AWAITING_FINAL_CONFIRMATION', 'show confirmation only after invitation details');
await send('confirm');
assert(savedBooking?.teammates?.length === 2 && savedBooking.subject === 'Sprint planning' && savedBooking.description.includes('assign owners'), 'booking retains invitees, title, and description');

console.log(`Conversation workflow tests complete. Failed: ${failed}`);
process.exit(failed ? 1 : 0);
