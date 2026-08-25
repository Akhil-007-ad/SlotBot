import { normalizeTime } from "./parser.js";

const pad = value => String(value).padStart(2, '0');
const toTime = (hour, minute, meridiem) => {
  let normalizedHour = Number(hour);
  if (meridiem === 'pm' && normalizedHour < 12) normalizedHour += 12;
  if (meridiem === 'am' && normalizedHour === 12) normalizedHour = 0;
  return `${pad(normalizedHour)}:${pad(minute || 0)}`;
};

export const toLocalDateTime = (date, time) => {
  if (!date || !time) return null;

  const normalized = normalizeTime(time);

  if (!normalized) return null;

  const [hour, minute] = normalized.split(':').map(Number);

  const result = new Date(`${date}T00:00:00`);

  result.setHours(hour, minute, 0, 0);

  return result;
};

const extractDate = text => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const lower = text.toLowerCase();
  const result = new Date(today);
  if (/\bday after tomorrow\b/.test(lower)) result.setDate(result.getDate() + 2);
  else if (/\btomorrow\b/.test(lower)) result.setDate(result.getDate() + 1);
  else if (/\btoday\b/.test(lower)) { /* use today */ }
  else {
    const numeric = lower.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (numeric) return `${numeric[1]}-${pad(numeric[2])}-${pad(numeric[3])}`;
    const named = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i);
    if (!named) return undefined;
    const month = new Date(`${named[1]} 1, 2000`).getMonth();
    result.setMonth(month, Number(named[2]));
    if (named[3]) result.setFullYear(Number(named[3]));
    else if (result < today) result.setFullYear(result.getFullYear() + 1);
  }
  return `${result.getFullYear()}-${pad(result.getMonth() + 1)}-${pad(result.getDate())}`;
};

const extractTimes = text => {
  const found = [];
  const bareHourRange = text.match(/\b(?:from\s+)?([01]?\d|2[0-3])\s*(?:to|until|till|-)\s*([01]?\d|2[0-3])\b/i);
  if (bareHourRange && !/\b(?:am|pm)\b/i.test(text)) {
    const normalise = hour => `${pad(Number(hour) >= 1 && Number(hour) <= 7 ? Number(hour) + 12 : Number(hour))}:00`;
    return [normalise(bareHourRange[1]), normalise(bareHourRange[2])];
  }
  const bareRange = text.match(/\b(\d{1,2}):([0-5]\d)\s*(?:to|until|till|-)\s*(\d{1,2}):([0-5]\d)\b/i);
  if (bareRange && !/\b(?:am|pm)\b/i.test(text)) {
    const normalise = (hour, minute) => `${pad(Number(hour) >= 1 && Number(hour) <= 7 ? Number(hour) + 12 : Number(hour))}:${minute}`;
    return [normalise(bareRange[1], bareRange[2]), normalise(bareRange[3], bareRange[4])];
  }
  const pattern = /\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) found.push(match[3] ? toTime(match[1], match[2], match[3].toLowerCase()) : `${pad(match[4])}:${match[5]}`);
  // Natural ranges such as "5:40 to 6:40" omit AM/PM. For office bookings,
  // 1–7 are interpreted as afternoon when no meridiem is supplied.
  return found;
};

export const extractBookingDetails = (message, rooms = [], currentState = {}) => {
  const text = message.trim();
  const lower = text.toLowerCase();
  const details = {};
  const attendees = lower.match(/\b(\d+)\s*(?:people|persons?|members?|guests?|attendees?|participants?|colleagues?|team(?:\s+members?)?)\b|\bfor\s+(\d+)\b/i);
  if (attendees) details.attendeeCount = Number(attendees[1] || attendees[2]);
  details.date = extractDate(text);

  const times = extractTimes(text);
  if (times.length >= 2) { details.startTime = times[0]; details.endTime = times[1]; }
  else if (times.length === 1) {
    const explicitlyStart = /\b(start|from|at)\b/i.test(lower);
    const explicitlyEnd = /\b(until|to|till|end)\b/i.test(lower);
    // Slot filling stays adaptive: when a start exists and the end is missing,
    // a bare time answers the missing end-time slot rather than overwriting
    // the start time supplied in a previous message.
    if (explicitlyEnd || (!explicitlyStart && currentState.startTime && !currentState.endTime)) details.endTime = times[0];
    else details.startTime = times[0];
  }

  const duration = lower.match(/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (duration && details.startTime && !details.endTime) {
    const [hour, minute] = details.startTime.split(':').map(Number);
    const end = new Date(2000, 0, 1, hour, minute + Number(duration[1]) * 60);
    details.endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  }

  if (/\b(with|need|require|requiring|has|have)\s+(a\s+)?(?:tv|television|display|screen)\b|\b(tv|display)\s+(?:required|needed|available|availability)\b/i.test(lower)) details.tvRequired = true;
  if (/\b(no|without|don't need|do not need)\s+(?:a\s+)?(?:tv|television|display|screen)\b/i.test(lower)) details.tvRequired = false;

  const room = rooms.find(item => lower.includes(item.name.toLowerCase()));
  if (room) { details.selectedRoomId = room.id || room._id?.toString() || room.name; details.selectedRoomName = room.name; }

  const emails = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g);
  if (emails) details.participants = [...new Set(emails.map(email => email.toLowerCase()))];
  if (/\b(none|only me|just me|no participants)\b/i.test(lower)) details.participants = [];
  const subject = text.match(/\b(?:subject|title)\s*:\s*(.+)$/i);
  if (subject) details.subject = subject[1].trim();
  const description = text.match(/\b(?:description|agenda|details)\s*:\s*(.+)$/i);
  if (description) details.description = description[1].trim();
  return details;
};
