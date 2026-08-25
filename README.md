# SlotBot

SlotBot is an Entra-authenticated meeting-room booking application for the Hyderabad offices. It reads rooms and bookings from MongoDB, validates room capacity and access roles, and can synchronize confirmed bookings with Microsoft 365 and Teams.

## Setup

1. Copy `backend/.env.example` to `backend/.env` and fill in MongoDB and Microsoft Entra values.
2. Copy `frontend/.env.example` to `frontend/.env` and use the SPA application's client ID and the API scope exposed by the API application registration.
3. In Entra, configure the SPA redirect URI as the frontend URL, expose the API scope `access_as_user`, grant the SPA delegated permission to that scope, and define app roles such as `Admin`, `IT`, `HR`, `L&D`, `Finance`, and `Management` when role-restricted rooms are required.
4. Run `npm run seed` in `backend`, then start the backend and frontend development servers.

## Backend structure

`backend/server.js` only starts the API. Requests then flow through `routes/` → `middleware/` → `controllers/` → `services/` → `models/`.

- `config/`: environment and database startup.
- `routes/`: URL definitions only.
- `controllers/`: HTTP request and response handling.
- `services/`: booking, room, and Microsoft Graph business logic.
- `chatbot/`: conversation state and message parsing.
- `models/`: MongoDB schemas.
- `middleware/`: Entra authentication and shared error handling.

## Adaptive booking input

SlotBot uses one `BookingSession` for the whole conversation. Every message is passed through `chatbot/extraction.js`, which extracts attendee count, date, start/end time, TV preference, room selection, and participant emails. Extracted values are merged without discarding values already supplied by the user. SlotBot supports **today-only** bookings: it keeps the current date automatically and rejects requests for another date. When attendee count and start/end time are available, it immediately searches eligible rooms and returns selectable room cards.

## Microsoft 365 sync

Set `MS365_ENABLED=true` only after configuring the room-mailbox addresses and Microsoft Graph application permissions. The booking API checks Outlook availability before confirmation, creates an Outlook/Teams event, and removes the event when the booking is cancelled.
