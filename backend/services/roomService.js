import Room from '../models/Room.js';

/**
 * Returns true if the user is allowed to access this room.
 * A room is accessible when:
 *  - authorizedRoles contains 'Everyone'  (open to all authenticated users), OR
 *  - authorizedRoles contains the user's department (department-restricted room)
 *
 * @param {Object} room       - Mongoose Room document
 * @param {Object} [user]     - req.user ({ department: string, ... })
 */
export const isRoomAuthorized = (room, user) => {
  if (room.authorizedRoles.includes('Everyone')) return true;
  if (!user?.department) return false;
  return room.authorizedRoles.some(
    role => role.toLowerCase() === user.department.toLowerCase()
  );
};

/**
 * Fetch active rooms, optionally filtered by minimum capacity and the
 * signed-in user's department.
 *
 * @param {number} [minCapacity]
 * @param {Object} [user]          - full req.user object
 */
export const getActiveRooms = async (minCapacity, user) => {
  const filter = { isActive: true };
  if (Number.isFinite(minCapacity)) filter.sittingCapacity = { $gte: minCapacity };
  const rooms = await Room.find(filter).sort({ floor: 1, sittingCapacity: 1, name: 1 });
  return user ? rooms.filter(room => isRoomAuthorized(room, user)) : rooms;
};

/**
 * Lightweight room list used by the chatbot state machine.
 *
 * @param {Object} [user] - full req.user object
 */
export const getChatRooms = async (user) =>
  (await getActiveRooms(undefined, user)).map(room => ({
    id:                room._id.toString(),
    name:              room.name,
    capacity:          room.sittingCapacity,
    roomType:          room.roomType,
    floor:             room.floor,
    location:          room.location,
    tvAvailability:    room.tvAvailability,
    minBookingHours:   room.minBookingHours,
    maxBookingHours:   room.maxBookingHours,
    authorizedRoles:   room.authorizedRoles,
    isRestricted:      !(room.authorizedRoles.length === 1 && room.authorizedRoles[0] === 'Everyone'),
    outlookEmail:      room.outlookEmail || null
  }));

export const updateRoomOutlookEmail = (name, outlookEmail) => Room.findOneAndUpdate(
  { name: { $regex: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
  { $set: { outlookEmail: outlookEmail.trim().toLowerCase() } },
  { new: true }
);
