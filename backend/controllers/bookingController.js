import { cancelRoomBookingEvent, isMS365Enabled } from '../services/graphService.js';
import { getBookingById, getTodayBookings } from '../services/bookingService.js';

export const listToday = async (req, res, next) => {
  try { res.json(await getTodayBookings()); } catch (error) { next(error); }
};

export const cancel = async (req, res, next) => {
  try {
    const booking = await getBookingById(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'Booking is already cancelled' });

    // Only the person who booked it (matched by email) may cancel it
    if (booking.bookedByEmail && booking.bookedByEmail !== req.user.email) {
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
