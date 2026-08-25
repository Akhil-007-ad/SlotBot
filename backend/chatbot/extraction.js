import { normalizeTime } from './parser.js';


const pad = value =>
  String(value).padStart(2, '0');


const toTime = (
  hour,
  minute,
  meridiem
) => {

  let normalizedHour =
    Number(hour);

  if (
    meridiem === 'pm' &&
    normalizedHour < 12
  ) {
    normalizedHour += 12;
  }

  if (
    meridiem === 'am' &&
    normalizedHour === 12
  ) {
    normalizedHour = 0;
  }

  return `${pad(normalizedHour)}:${pad(
    minute || 0
  )}`;
};


export const toLocalDateTime = (
  date,
  time
) => {

  if (!date || !time) {
    return null;
  }

  const normalized =
    normalizeTime(time);

  if (!normalized) {
    return null;
  }

  const [hour, minute] =
    normalized
      .split(':')
      .map(Number);

  const result =
    new Date(`${date}T00:00:00`);

  result.setHours(
    hour,
    minute,
    0,
    0
  );

  return result;
};


/* ============================================================
   DATE
============================================================ */

const extractDate = text => {

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const lower =
    text.toLowerCase();

  const result =
    new Date(today);


  if (
    /\bday after tomorrow\b/.test(lower)
  ) {

    result.setDate(
      result.getDate() + 2
    );

  } else if (
    /\btomorrow\b/.test(lower)
  ) {

    result.setDate(
      result.getDate() + 1
    );

  } else if (
    /\btoday\b/.test(lower)
  ) {

    // today

  } else {

    const numeric =
      lower.match(
        /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/
      );

    if (numeric) {

      return [
        numeric[1],
        pad(numeric[2]),
        pad(numeric[3])
      ].join('-');
    }


    const named =
      lower.match(
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i
      );


    if (!named) {
      return undefined;
    }


    const month =
      new Date(
        `${named[1]} 1, 2000`
      ).getMonth();


    result.setMonth(
      month,
      Number(named[2])
    );


    if (named[3]) {

      result.setFullYear(
        Number(named[3])
      );

    } else if (
      result < today
    ) {

      result.setFullYear(
        result.getFullYear() + 1
      );
    }
  }


  return [
    result.getFullYear(),
    pad(result.getMonth() + 1),
    pad(result.getDate())
  ].join('-');
};


/* ============================================================
   YES / NO
============================================================ */

export const parseYesNo = text => {

  const value =
    String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[.!?,]/g, '')
      .replace(/\s+/g, ' ');


  /*
   * YES
   */
  if (
    /^(yes|y|yeah|yea|yaa|yep|yup|sure|ok|okay|alright|correct|true)$/i
      .test(value)
  ) {

    return true;
  }


  if (
    /\b(yes|yeah|yea|yaa|yep|yup|sure|correct|we do|i do|needed|required)\b/i.test(value)
  ) {

    return true;
  }


  /*
   * NO
   */
  if (
    /^(no|n|nope|nah|none|false)$/i
      .test(value)
  ) {

    return false;
  }


  if (
    /\b(no|nope|nah|none|not needed|don't need|do not need|we don't need|we do not need)\b/i.test(value)
  ) {

    return false;
  }


  return null;
};


/* ============================================================
   ATTENDEE COUNT
============================================================ */

const extractAttendeeCount = text => {

  const trimmed =
    text.trim();


  /*
   * Direct number:
   *
   * "5"
   */
  if (
    /^\d+$/.test(trimmed)
  ) {

    return Number(trimmed);
  }


  /*
   * "5 people"
   * "5 attendees"
   * "5 members"
   */
  const labelled =
    trimmed.match(
      /\b(\d+)\s*(?:people|persons?|members?|guests?|attendees?|participants?|colleagues?|team(?:\s+members?)?)\b/i
    );


  if (labelled) {

    return Number(
      labelled[1]
    );
  }


  /*
   * "for 5"
   */
  const forCount =
    trimmed.match(
      /\bfor\s+(\d+)\b/i
    );


  if (forCount) {

    return Number(
      forCount[1]
    );
  }


  /*
   * Natural statements.
   */
  const natural =
    trimmed.match(
      /\b(?:there\s+will\s+be|we\s+have|we'll\s+have|around|about|approximately)\s+(\d+)\b/i
    );


  if (natural) {

    return Number(
      natural[1]
    );
  }


  return undefined;
};


/* ============================================================
   TIME EXTRACTION
============================================================ */

const extractTimes = text => {

  const found = [];


  const bareHourRange =
    text.match(
      /\b(?:from\s+)?([01]?\d|2[0-3])\s*(?:to|until|till|-)\s*([01]?\d|2[0-3])\b/i
    );


  if (
    bareHourRange &&
    !/\b(?:am|pm)\b/i.test(text)
  ) {

    const normalise =
      hour => {

        const value =
          Number(hour);

        return `${pad(
          value >= 1 && value <= 7
            ? value + 12
            : value
        )}:00`;
      };


    return [
      normalise(
        bareHourRange[1]
      ),
      normalise(
        bareHourRange[2]
      )
    ];
  }


  const bareRange =
    text.match(
      /\b(\d{1,2}):([0-5]\d)\s*(?:to|until|till|-)\s*(\d{1,2}):([0-5]\d)\b/i
    );


  if (
    bareRange &&
    !/\b(?:am|pm)\b/i.test(text)
  ) {

    const normalise =
      (hour, minute) => {

        const value =
          Number(hour);

        return `${pad(
          value >= 1 && value <= 7
            ? value + 12
            : value
        )}:${minute}`;
      };


    return [
      normalise(
        bareRange[1],
        bareRange[2]
      ),
      normalise(
        bareRange[3],
        bareRange[4]
      )
    ];
  }


  const pattern =
    /\b(1[0-2]|[1-9])(?::([0-5]\d))?\s*(am|pm)\b|\b([01]?\d|2[0-3]):([0-5]\d)\b/gi;


  let match;


  while (
    (match = pattern.exec(text)) !== null
  ) {

    found.push(

      match[3]

        ? toTime(
            match[1],
            match[2],
            match[3].toLowerCase()
          )

        : `${pad(match[4])}:${match[5]}`
    );
  }


  return found;
};


/* ============================================================
   ROOM
============================================================ */

const extractRoom = (
  text,
  rooms
) => {

  const lower =
    text.toLowerCase();


  const room =
    rooms.find(
      item =>
        lower.includes(
          item.name.toLowerCase()
        )
    );


  if (!room) {
    return undefined;
  }


  return {
    selectedRoomId:
      room.id ||
      room._id?.toString() ||
      room.name,

    selectedRoomName:
      room.name
  };
};


/* ============================================================
   PARTICIPANTS
============================================================ */

const extractParticipants = text => {

  const emails =
    text.match(
      /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g
    );


  if (emails) {

    return [
      ...new Set(
        emails.map(
          email =>
            email.toLowerCase()
        )
      )
    ];
  }


  /*
   * Explicitly no participants.
   */
  if (
    /^(none|no|n|no participants|nobody|no one|only me|just me)$/i
      .test(text.trim())
  ) {

    return [];
  }


  return undefined;
};


/* ============================================================
   EXPECTED-FIELD EXTRACTION
============================================================ */

/**
 * Handles short answers according to the question
 * currently being asked.
 */
const extractExpectedField = (
  text,
  expectedField
) => {

  if (!expectedField) {
    return {};
  }


  /* ----------------------------------------------------------
     ATTENDEE COUNT
  ---------------------------------------------------------- */

  if (
    expectedField === 'attendeeCount'
  ) {

    const count =
      extractAttendeeCount(text);

    if (
      count !== undefined
    ) {

      return {
        attendeeCount:
          count
      };
    }
  }


  /* ----------------------------------------------------------
     START TIME
  ---------------------------------------------------------- */

  if (
    expectedField === 'startTime'
  ) {

    const times =
      extractTimes(text);


    /*
     * "2 PM"
     * "2:30 PM"
     * "14:30"
     */
    if (times.length >= 1) {

      return {
        startTime:
          times[0]
      };
    }


    /*
     * Simple number:
     *
     * "2"
     *
     * Office hours interpretation:
     * 1-7 => PM
     */
    if (
      /^\d{1,2}$/.test(
        text.trim()
      )
    ) {

      const hour =
        Number(
          text.trim()
        );


      if (
        hour >= 0 &&
        hour <= 23
      ) {

        const normalizedHour =
          hour >= 1 && hour <= 7
            ? hour + 12
            : hour;


        return {
          startTime:
            `${pad(
              normalizedHour
            )}:00`
        };
      }
    }
  }


  /* ----------------------------------------------------------
     END TIME
  ---------------------------------------------------------- */

  if (
    expectedField === 'endTime'
  ) {

    const times =
      extractTimes(text);


    if (times.length >= 1) {

      return {
        endTime:
          times[0]
      };
    }


    if (
      /^\d{1,2}$/.test(
        text.trim()
      )
    ) {

      const hour =
        Number(
          text.trim()
        );


      if (
        hour >= 0 &&
        hour <= 23
      ) {

        const normalizedHour =
          hour >= 1 && hour <= 7
            ? hour + 12
            : hour;


        return {
          endTime:
            `${pad(
              normalizedHour
            )}:00`
        };
      }
    }
  }


  /* ----------------------------------------------------------
     TV
  ---------------------------------------------------------- */

  if (
    expectedField === 'tvRequired'
  ) {

    const answer =
      parseYesNo(text);


    if (answer !== null) {

      return {
        tvRequired:
          answer
      };
    }
  }


  /* ----------------------------------------------------------
     PARTICIPANTS
  ---------------------------------------------------------- */

  if (
    expectedField === 'participants'
  ) {

    const participants =
      extractParticipants(text);


    if (
      participants !== undefined
    ) {

      return {
        participants
      };
    }
  }


  /* ----------------------------------------------------------
     SUBJECT
  ---------------------------------------------------------- */

  if (
    expectedField === 'subject'
  ) {

    const value =
      text.trim();


    if (value) {

      return {
        subject:
          value
      };
    }
  }


  /* ----------------------------------------------------------
     DESCRIPTION
  ---------------------------------------------------------- */

  if (
    expectedField === 'description'
  ) {

    if (
      /^(none|no description)$/i
        .test(text.trim())
    ) {

      return {
        description:
          ''
      };
    }


    const value =
      text.trim();


    if (value) {

      return {
        description:
          value
      };
    }
  }


  return {};
};


/* ============================================================
   MAIN EXTRACTOR
============================================================ */

export const extractBookingDetails = (
  message,
  rooms = [],
  currentState = {},
  expectedField = null
) => {

  const text =
    String(message || '')
      .trim();


  const lower =
    text.toLowerCase();


  const details = {};


  /*
   * ----------------------------------------------------------
   * FIRST:
   *
   * Interpret the answer according to the question
   * currently being asked.
   * ----------------------------------------------------------
   */

  const expected =
    extractExpectedField(
      text,
      expectedField
    );


  Object.assign(
    details,
    expected
  );


  /*
   * ----------------------------------------------------------
   * THEN:
   *
   * Extract everything else from the message.
   *
   * This allows:
   *
   * "5 people from 2 PM to 4 PM with TV"
   *
   * to fill multiple fields at once.
   * ----------------------------------------------------------
   */


  /*
   * ATTENDEE COUNT
   */
  if (
    details.attendeeCount === undefined
  ) {

    const count =
      extractAttendeeCount(text);


    if (
      count !== undefined
    ) {

      details.attendeeCount =
        count;
    }
  }


  /*
   * DATE
   */
  const date =
    extractDate(text);


  if (
    date !== undefined &&
    /\b(today|tomorrow|day after tomorrow|\d{4}[-/]\d{1,2}[-/]\d{1,2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i
      .test(text)
  ) {

    details.date =
      date;
  }


  /*
   * TIMES
   */
  const times =
    extractTimes(text);


  if (
    times.length >= 2
  ) {

    details.startTime =
      times[0];

    details.endTime =
      times[1];

  } else if (
    times.length === 1
  ) {

    const explicitlyStart =
      /\b(start|from|at)\b/i
        .test(lower);


    const explicitlyEnd =
      /\b(until|to|till|end)\b/i
        .test(lower);


    if (
      expectedField === 'endTime' ||
      explicitlyEnd ||
      (
        !explicitlyStart &&
        currentState.startTime &&
        !currentState.endTime
      )
    ) {

      details.endTime =
        times[0];

    } else if (
      expectedField !== 'endTime'
    ) {

      details.startTime =
        times[0];
    }
  }


  /*
   * DURATION
   */
  const duration =
    lower.match(
      /\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i
    );


  if (
    duration &&
    details.startTime &&
    !details.endTime
  ) {

    const [
      hour,
      minute
    ] =
      details.startTime
        .split(':')
        .map(Number);


    const end =
      new Date(
        2000,
        0,
        1,
        hour,
        minute +
          Number(duration[1]) * 60
      );


    details.endTime =
      `${pad(end.getHours())}:${pad(
        end.getMinutes()
      )}`;
  }


  /*
   * TV
   */
  if (
    details.tvRequired === undefined
  ) {

    const tvYes =
      /\b(with|need|require|requiring|has|have)\s+(a\s+)?(?:tv|television|display|screen)\b|\b(tv|display)\s+(?:required|needed)\b/i
        .test(lower);


    const tvNo =
      /\b(no|without|don't need|do not need)\s+(?:a\s+)?(?:tv|television|display|screen)\b/i
        .test(lower);


    if (tvYes) {

      details.tvRequired =
        true;

    } else if (tvNo) {

      details.tvRequired =
        false;
    }
  }


  /*
   * ROOM
   */
  const room =
    extractRoom(
      text,
      rooms
    );


  if (room) {

    Object.assign(
      details,
      room
    );
  }


  /*
   * PARTICIPANTS
   */
  if (
    details.participants === undefined
  ) {

    const participants =
      extractParticipants(text);


    if (
      participants !== undefined
    ) {

      details.participants =
        participants;
    }
  }


  /*
   * SUBJECT
   */
  const subject =
    text.match(
      /\b(?:subject|title)\s*:\s*(.+)$/i
    );


  if (subject) {

    details.subject =
      subject[1].trim();
  }


  /*
   * DESCRIPTION
   */
  const description =
    text.match(
      /\b(?:description|agenda|details)\s*:\s*(.+)$/i
    );


  if (description) {

    details.description =
      description[1].trim();
  }


  return details;
};