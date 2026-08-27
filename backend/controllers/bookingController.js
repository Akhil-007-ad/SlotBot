import { cancelRoomBookingEvent, isMS365Enabled } from '../services/graphService.js';
import { getBookingById, getBookingHistory, getBookingsForDay } from '../services/bookingService.js';

export const listToday = async (req, res, next) => {
  try {
    const day = req.query.day || 'today';
    if (!['today', 'tomorrow'].includes(day)) {
      return res.status(400).json({ error: 'day must be today or tomorrow.' });
    }
    res.json(await getBookingsForDay(day === 'tomorrow' ? 1 : 0, req.user));
  } catch (error) { next(error); }
};

export const cancel = async (req, res, next) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'Booking is already cancelled' });

    const organizerIdMatches = Boolean(
      booking.bookedById && booking.bookedById === req.user.id
    );
    const organizerEmailMatches = Boolean(
      booking.bookedByEmail && req.user.email &&
      booking.bookedByEmail.toLowerCase() === req.user.email.toLowerCase()
    );
    if (!organizerIdMatches && !organizerEmailMatches) {
      return res.status(403).json({ error: 'You can only cancel your own bookings.' });
    }

    booking.status = 'cancelled';
    await booking.save();

    let ms365Note = null;
    if (isMS365Enabled() && booking.outlookEventId) {
      if (!req.user?.accessToken) {
        ms365Note = 'Outlook event not deleted — no user token available.';
      } else {
        try {
          // Use the current user's OBO token to delete the event from their calendar
          await cancelRoomBookingEvent(booking.outlookEventId, req.user.accessToken);
          ms365Note = 'Outlook event deleted successfully';
        } catch (error) {
          console.error('MS365 cancel failed:', error.message);
          ms365Note = 'Outlook event deletion failed — please remove it manually from your calendar';
        }
      }
    }

    res.json({ message: 'Booking cancelled successfully', ms365Note });
  } catch (error) { next(error); }
};

export const history = async (req, res, next) => {
  try {
    const mode = req.query.mode || 'all';
    const scope = req.query.scope || 'all';
    if (!['all', 'bookedBy', 'included'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be all, bookedBy, or included.' });
    }
    if (!['all', 'today', 'future'].includes(scope)) {
      return res.status(400).json({ error: 'scope must be all, today, or future.' });
    }
    if (scope === 'future' && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Administrator access is required for future meetings.' });
    }

    const viewingAnotherUser = Boolean(req.query.userEmail);
    const requestedEmail = String(req.query.userEmail || req.user.email || '').trim();
    const requestedUserId = viewingAnotherUser ? null : req.user.id;
    if (mode !== 'all' && !requestedEmail && !requestedUserId) {
      return res.status(400).json({ error: 'A user identity is required for this filter.' });
    }
    if (viewingAnotherUser && requestedEmail.toLowerCase() !== req.user.email?.toLowerCase() && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Administrator access is required to view another user.' });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    res.json(await getBookingHistory({
      mode,
      scope,
      userEmail: requestedEmail,
      userId: requestedUserId,
      page,
      limit,
      user: req.user
    }));
  } catch (error) { next(error); }
};
