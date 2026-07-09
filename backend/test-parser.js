import { parseMessage } from './chatbot/parser.js';
import { detectNonTodayDates } from './chatbot/stateMachine.js';

const testCases = [
  {
    input: "I want to book Zenith room for 4 people today at 3 PM for 2 hours.",
    expected: { roomName: "Zenith", peopleCount: 4, durationHours: 2, startTimeStr: "15:00" }
  },
  {
    input: "book quantum for 8 guests at 10 am for 3h",
    expected: { roomName: "Quantum", peopleCount: 8, durationHours: 3, startTimeStr: "10:00" }
  },
  {
    input: "Apex room for 12 attendees at 14:30 for 1.5 hours",
    expected: { roomName: "Apex", peopleCount: 12, durationHours: 1.5, startTimeStr: "14:30" }
  },
  {
    input: "Book a room tomorrow",
    expectedDateReject: true
  },
  {
    input: "Can I book Zenith next Monday?",
    expectedDateReject: true
  }
];

console.log("Running Parser Verification Tests...");
let failed = 0;

testCases.forEach((tc, idx) => {
  console.log(`\nTest #${idx + 1}: "${tc.input}"`);
  
  if (tc.expectedDateReject) {
    const isRejected = detectNonTodayDates(tc.input);
    if (isRejected) {
      console.log("✅ Correctly rejected non-today date request.");
    } else {
      console.log("❌ Failed to reject non-today date request.");
      failed++;
    }
    return;
  }
  
  const parsed = parseMessage(tc.input);
  let tcFailed = false;
  
  for (const key of Object.keys(tc.expected)) {
    if (parsed[key] !== tc.expected[key]) {
      console.log(`❌ Mismatch for ${key}: expected "${tc.expected[key]}", got "${parsed[key]}"`);
      tcFailed = true;
    }
  }
  
  if (!tcFailed) {
    console.log("✅ Passed parser checks.");
  } else {
    failed++;
  }
});

console.log(`\nTests complete. Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
