/**
 * Helper to clean and parse numbers
 */
export const extractNumber = (text) => {
  const match = text.match(/\b\d+\b/);
  return match ? parseInt(match[0], 10) : null;
};

/**
 * Extracts all time strings in HH:MM format from text.
 */
export const parseTimes = (text) => {
  const times = [];
  const normalized = text.toLowerCase();

  // Find 12-hour matches: e.g. "2:30 pm", "10am", "2 pm"
  const time12Regex = /\b(1[0-2]|[1-9])(?::([0-5][0-9]))?\s*(am|pm)\b/gi;
  let match;
  while ((match = time12Regex.exec(normalized)) !== null) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3].toLowerCase();

    if (ampm === 'pm' && hour < 12) {
      hour += 12;
    } else if (ampm === 'am' && hour === 12) {
      hour = 0;
    }
    times.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
  }

  // Find 24-hour matches: e.g. "14:30", "09:00"
  const time24Regex = /\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/g;
  while ((match = time24Regex.exec(normalized)) !== null) {
    const val = `${match[1].padStart(2, '0')}:${match[2]}`;
    if (!times.includes(val)) {
      times.push(val);
    }
  }

  return times;
};

export const normalizeTime = (value) => {
  if (!value) return null;

  const text = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  const match = text.match(
    /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/
  );

  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const meridiem = match[3];

  if (minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }

    if (meridiem === 'am') {
      if (hour === 12) hour = 0;
    } else {
      if (hour !== 12) hour += 12;
    }
  } else {
    if (hour < 0 || hour > 23) {
      return null;
    }
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

/**
 * Parses free text to extract booking details
 */
export const parseMessage = (text, roomNames = []) => {
  const result = {};
  const cleanedText = text.trim();

  // 1. Extract Room Name
  const escapedNames = roomNames
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const roomMatch = escapedNames.length
    ? cleanedText.match(new RegExp(`\\b(${escapedNames.join('|')})\\b`, 'i'))
    : null;
  if (roomMatch) {
    result.roomName = roomNames.find(name => name.toLowerCase() === roomMatch[1].toLowerCase());
  }

  // 2. Extract People Count
  const peopleMatch = cleanedText.match(/\b(\d+)\s*(?:people|person|guests?|attendees?|capacity|of\s+us)\b/i) ||
    cleanedText.match(/\bfor\s+(\d+)\b/i);
  if (peopleMatch) {
    result.peopleCount = parseInt(peopleMatch[1], 10);
  }

  // 3. Extract Duration
  const durationMatch = cleanedText.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (durationMatch) {
    result.durationHours = parseFloat(durationMatch[1]);
  }

  // 4. Extract Times
  const times = parseTimes(cleanedText);
  if (times.length >= 2) {
    result.startTimeStr = times[0];
    result.endTimeStr = times[1];
  } else if (times.length === 1) {
    result.startTimeStr = times[0];
    result.endTimeStr = null;
  }

  // 5. Intent triggers
  if (cleanedText.match(/\b(book|reserve|meeting|schedule|new booking|start over|reset|restart)\b/i)) {
    result.intent = 'book';
  }
  if (cleanedText.match(/\b(confirm|yes|correct|fine|ok|okay|approve|agree)\b/i)) {
    result.intent = 'confirm';
  }
  if (cleanedText.match(/\b(cancel|no|stop|reject|wrong|incorrect|clear)\b/i)) {
    result.intent = 'cancel';
  }

  return result;
};

/**
 * Normalizes a time string (HH:MM) to today's local Date object
 */
export const timeStringToDate = (timeStr) => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);

  const date = new Date(); // Current local time
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const parseTvRequirement = (message) => {
  const text = message
    .trim()
    .toLowerCase();

  if (/^(yes|yeah|yep|y|sure|true)$/i.test(text)) {
    return true;
  }

  if (/^(no|nope|n|false)$/i.test(text)) {
    return false;
  }

  if (
    /\b(with|need|required|requires|want)\b.*\b(tv|display)\b/i.test(text)
  ) {
    return true;
  }

  if (
    /\b(without|no|don't need|do not need)\b.*\b(tv|display)\b/i.test(text)
  ) {
    return false;
  }

  return undefined;
};