import { OnBehalfOfCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';

// ─── Build a Graph client scoped to the signed-in user (OBO flow) ────────────
//
// The frontend sends its Entra access token (scoped to the backend API).
// The backend exchanges that token for a Graph-scoped token via OBO so that:
//   - Calendar events are created on the USER's calendar
//   - The user appears as the organiser on all invites
//   - No separate service account mailbox is needed
//
// Azure app registration requirements:
//   - API permission: Calendars.ReadWrite (Delegated)
//   - "Allow public client flows" or "Web" platform with OBO enabled
//   - The app must NOT require admin consent for Calendars.ReadWrite for OBO to work

const buildUserGraphClient = (userAccessToken) => {
  const credential = new OnBehalfOfCredential({
    tenantId:           process.env.MS_TENANT_ID,
    clientId:           process.env.MS_CLIENT_ID,
    clientSecret:       process.env.MS_CLIENT_SECRET,
    userAssertionToken: userAccessToken
  });

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default']
  });

  return Client.initWithMiddleware({ authProvider });
};

// ─── Check if MS365 integration is enabled ──────────────────────────────────
export const isMS365Enabled = () => process.env.MS365_ENABLED === 'true';

// ─── Create a Room Booking Event on the user's Outlook calendar ──────────────
/**
 * Creates a calendar event that:
 *  1. Books the physical room (via resource attendee → Exchange auto-accepts)
 *  2. Generates a Teams meeting link (isOnlineMeeting = true)
 *  3. Appears on the BOOKER'S Outlook calendar — they are the organiser
 *
 * @param {Object} params
 * @param {string} params.userAccessToken   - Bearer token from the signed-in user (for OBO)
 * @param {string} params.roomName          - Display name of the room (e.g. "Nova")
 * @param {string} params.outlookEmail      - Room mailbox email from Exchange Online
 * @param {Date}   params.startTime         - JS Date object for meeting start
 * @param {Date}   params.endTime           - JS Date object for meeting end
 * @param {number} params.peopleCount       - Number of attendees
 * @param {string} [params.meetingTitle]    - Optional custom meeting subject
 *
 * @returns {Promise<{outlookEventId: string, teamsLink: string|null}>}
 */
export const createRoomBookingEvent = async ({
  userAccessToken,
  roomName,
  outlookEmail,
  startTime,
  endTime,
  peopleCount,
  meetingTitle,
  teammates = [],
  description = ''
}) => {
  const client   = buildUserGraphClient(userAccessToken);
  const timezone = process.env.MS_TIMEZONE || 'Asia/Kolkata';
  const subject  = meetingTitle || `${roomName} — Meeting (${peopleCount} people)`;

  const event = {
    subject,
    start: {
      dateTime: startTime.toISOString().replace('Z', ''),
      timeZone: timezone
    },
    end: {
      dateTime: endTime.toISOString().replace('Z', ''),
      timeZone: timezone
    },
    // ✅ Generates a Teams meeting link automatically
    isOnlineMeeting:       true,
    onlineMeetingProvider: 'teamsForBusiness',
    // ✅ Room resource booking + teammate attendees
    attendees: [
      {
        emailAddress: {
          address: outlookEmail,
          name:    roomName
        },
        type: 'resource'
      },
      ...teammates.map(email => ({
        emailAddress: {
          address: email,
          name:    email.split('@')[0]
        },
        type: 'required'
      }))
    ],
    location: {
      displayName:  roomName,
      locationType: 'conferenceRoom'
    },
    body: {
      contentType: 'html',
      content: description ? `<p>${description.replace(/\n/g, '<br>')}</p>` : `
        <p>This meeting was booked via <strong>SlotBot</strong>.</p>
        <p><strong>Room:</strong> ${roomName}</p>
        <p><strong>Attendees:</strong> ${peopleCount} people</p>
      `
    }
  };

  // POST to /me/events — event is created on the signed-in user's calendar
  const createdEvent = await client.api('/me/events').post(event);

  return {
    outlookEventId: createdEvent.id,
    teamsLink:      createdEvent.onlineMeeting?.joinUrl || null
  };
};

// ─── Cancel / Delete a Room Booking Event ────────────────────────────────────
/**
 * Deletes the Outlook calendar event for a cancelled booking.
 * This also frees the room's Exchange calendar automatically.
 *
 * @param {string} outlookEventId   - The event ID returned at booking time
 * @param {string} userAccessToken  - Bearer token of the user who owns the event
 */
export const cancelRoomBookingEvent = async (outlookEventId, userAccessToken) => {
  const client = buildUserGraphClient(userAccessToken);
  await client.api(`/me/events/${outlookEventId}`).delete();
};

// ─── Check Room Availability via Graph ───────────────────────────────────────
/**
 * Checks if a room is free for a given time window using the getSchedule API.
 * Returns true if the room is available, false if busy.
 *
 * @param {string} outlookEmail     - Room mailbox email
 * @param {Date}   startTime
 * @param {Date}   endTime
 * @param {string} userAccessToken  - Bearer token of the signed-in user (for OBO)
 */
export const checkRoomAvailability = async (outlookEmail, startTime, endTime, userAccessToken) => {
  const client   = buildUserGraphClient(userAccessToken);
  const timezone = process.env.MS_TIMEZONE || 'Asia/Kolkata';

  const response = await client
    .api('/me/calendar/getSchedule')
    .post({
      schedules: [outlookEmail],
      startTime: {
        dateTime: startTime.toISOString().replace('Z', ''),
        timeZone: timezone
      },
      endTime: {
        dateTime: endTime.toISOString().replace('Z', ''),
        timeZone: timezone
      },
      availabilityViewInterval: 30
    });

  const schedule = response.value?.[0];
  if (!schedule) return true; // Default to available if no data

  // availabilityView: '0' = free, '1' = tentative, '2' = busy, '3' = out of office
  const isBusy = schedule.availabilityView?.includes('2') ||
                 schedule.scheduleItems?.some(item => item.status === 'busy');

  return !isBusy;
};

// ─── Check Teammates Availability via Graph ──────────────────────────────────
/**
 * Checks which of the specified teammate emails are busy during the given time.
 * Returns an array of busy emails.
 */
export const checkTeammatesAvailability = async (emails, startTime, endTime, userAccessToken) => {
  const client   = buildUserGraphClient(userAccessToken);
  const timezone = process.env.MS_TIMEZONE || 'Asia/Kolkata';

  const response = await client
    .api('/me/calendar/getSchedule')
    .post({
      schedules: emails,
      startTime: {
        dateTime: startTime.toISOString().replace('Z', ''),
        timeZone: timezone
      },
      endTime: {
        dateTime: endTime.toISOString().replace('Z', ''),
        timeZone: timezone
      },
      availabilityViewInterval: 30
    });

  const busyEmails = [];
  for (const item of response.value || []) {
    const viewChars = item.availabilityView?.split('') || [];
    const isBusy = viewChars.some(char => char === '2' || char === '3') ||
                   item.scheduleItems?.some(sItem => sItem.status === 'busy' || sItem.status === 'oof');
    if (isBusy) {
      busyEmails.push(item.scheduleId);
    }
  }

  return busyEmails;
};

// ─── Find First Free Slot via Graph ──────────────────────────────────────────
/**
 * Searches for the first time slot today where the room and all teammates are free.
 * Returns the start time string (e.g. "15:30") or null.
 */
export const findFirstFreeSlotGraph = async (emails, roomEmail, durationHours, userAccessToken) => {
  const client   = buildUserGraphClient(userAccessToken);
  const timezone = process.env.MS_TIMEZONE || 'Asia/Kolkata';

  const now = new Date();
  const startSearch = new Date(now);
  const mins = startSearch.getMinutes();
  if (mins > 0 && mins <= 30) {
    startSearch.setMinutes(30, 0, 0);
  } else if (mins > 30) {
    startSearch.setHours(startSearch.getHours() + 1, 0, 0, 0);
  } else {
    startSearch.setMinutes(0, 0, 0);
  }

  const midnight = new Date();
  midnight.setHours(23, 59, 0, 0);

  const response = await client
    .api('/me/calendar/getSchedule')
    .post({
      schedules: [...emails, roomEmail],
      startTime: {
        dateTime: startSearch.toISOString().replace('Z', ''),
        timeZone: timezone
      },
      endTime: {
        dateTime: midnight.toISOString().replace('Z', ''),
        timeZone: timezone
      },
      availabilityViewInterval: 30
    });

  const schedulesMap = {};
  for (const item of response.value || []) {
    schedulesMap[item.scheduleId] = (item.scheduleItems || []).map(sItem => ({
      start: new Date(sItem.start.dateTime + (sItem.start.timeZone === 'UTC' ? 'Z' : '')),
      end: new Date(sItem.end.dateTime + (sItem.end.timeZone === 'UTC' ? 'Z' : ''))
    }));
  }

  let currentStart = new Date(startSearch);
  const durMs = durationHours * 60 * 60 * 1000;

  while (currentStart.getTime() + durMs <= midnight.getTime()) {
    const currentEnd = new Date(currentStart.getTime() + durMs);

    let slotIsFree = true;
    for (const email of [...emails, roomEmail]) {
      const busyList = schedulesMap[email] || [];
      const hasOverlap = busyList.some(busy => {
        return busy.start < currentEnd && busy.end > currentStart;
      });
      if (hasOverlap) {
        slotIsFree = false;
        break;
      }
    }

    if (slotIsFree) {
      const hStr = currentStart.getHours().toString().padStart(2, '0');
      const mStr = currentStart.getMinutes().toString().padStart(2, '0');
      return `${hStr}:${mStr}`;
    }

    currentStart.setMinutes(currentStart.getMinutes() + 30);
  }

  return null;
};
