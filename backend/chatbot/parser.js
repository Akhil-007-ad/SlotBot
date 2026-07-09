/**
 * Helper to clean and parse numbers
 */
export const extractNumber = (text) => {
  const match = text.match(/\b\d+\b/);
  return match ? parseInt(match[0], 10) : null;
};

/**
 * Parses free text to extract booking details
 */
export const parseMessage = (text) => {
  const result = {};
  const cleanedText = text.trim();

  // 1. Extract Room Name
  const roomMatch = cleanedText.match(/\b(zenith|quantum|apex|nova)\b/i);
  if (roomMatch) {
    // Capitalize first letter
    result.roomName = roomMatch[1].charAt(0).toUpperCase() + roomMatch[1].slice(1).toLowerCase();
  }

  // 2. Extract People Count
  // Matches "5 people", "for 6 guests", "capacity 10", "12 of us"
  const peopleMatch = cleanedText.match(/\b(\d+)\s*(?:people|person|guests?|attendees?|capacity|of\s+us)\b/i) || 
                      cleanedText.match(/\bfor\s+(\d+)\b/i);
  if (peopleMatch) {
    result.peopleCount = parseInt(peopleMatch[1], 10);
  }

  // 3. Extract Duration
  // Matches "2 hours", "1.5 hrs", "3h", "for 4 hours"
  const durationMatch = cleanedText.match(/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  if (durationMatch) {
    result.durationHours = parseFloat(durationMatch[1]);
  }

  // 4. Extract Start Time
  // Matches "2:30 pm", "10 am", "14:00", "at 3 PM"
  // Try 12-hour format: e.g. "2:30 pm", "10am", "2 pm"
  const time12Match = cleanedText.match(/\b(1[0-2]|[1-9])(?::([0-5][0-9]))?\s*(am|pm)\b/i);
  if (time12Match) {
    let hour = parseInt(time12Match[1], 10);
    const minute = time12Match[2] ? parseInt(time12Match[2], 10) : 0;
    const ampm = time12Match[3].toLowerCase();

    if (ampm === 'pm' && hour < 12) {
      hour += 12;
    } else if (ampm === 'am' && hour === 12) {
      hour = 0;
    }

    result.startTimeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  } else {
    // Try 24-hour format: e.g. "14:30", "09:00", "18:00"
    const time24Match = cleanedText.match(/\b([0-1]?[0-9]|2[0-3]):([0-5][0-9])\b/);
    if (time24Match) {
      result.startTimeStr = `${time24Match[1].padStart(2, '0')}:${time24Match[2]}`;
    }
  }

  // 5. Intent triggers
  // Check if they want to book or reset
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
