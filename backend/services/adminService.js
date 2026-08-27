import Booking from '../models/Booking.js';

export const getMonthlyReport = async (month, year) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const [report] = await Booking.aggregate([
    { $match: { startTime: { $gte: start, $lt: end } } },
    {
      $facet: {
        totals: [{ $count: 'count' }],
        users: [
          {
            $project: {
              participants: {
                $concatArrays: [
                  [{
                    key: {
                      $toLower: {
                        $cond: [
                          { $ne: [{ $ifNull: ['$bookedByEmail', ''] }, ''] },
                          '$bookedByEmail',
                          { $ifNull: ['$bookedById', ''] }
                        ]
                      }
                    },
                    email: { $toLower: { $ifNull: ['$bookedByEmail', ''] } },
                    name: { $ifNull: ['$bookedByName', ''] },
                    organizer: true
                  }],
                  {
                    $map: {
                      input: { $ifNull: ['$teammates', []] },
                      as: 'email',
                      in: {
                        key: { $toLower: '$$email' },
                        email: { $toLower: '$$email' },
                        name: { $toLower: '$$email' },
                        organizer: false
                      }
                    }
                  }
                ]
              }
            }
          },
          { $unwind: '$participants' },
          { $match: { 'participants.key': { $ne: '' } } },
          {
            $group: {
              _id: { booking: '$_id', key: '$participants.key' },
              email: { $max: '$participants.email' },
              fallbackName: { $max: '$participants.name' },
              organizerName: { $max: { $cond: ['$participants.organizer', '$participants.name', ''] } },
              organizerCount: { $max: { $cond: ['$participants.organizer', 1, 0] } }
            }
          },
          {
            $group: {
              _id: '$_id.key',
              email: { $max: '$email' },
              fallbackName: { $max: '$fallbackName' },
              organizerName: { $max: '$organizerName' },
              includedCount: { $sum: 1 },
              organizerCount: { $sum: '$organizerCount' }
            }
          },
          {
            $project: {
              _id: 0,
              id: '$_id',
              email: { $cond: [{ $ne: ['$email', ''] }, '$email', null] },
              name: { $cond: [{ $ne: ['$organizerName', ''] }, '$organizerName', '$fallbackName'] },
              organizerCount: 1,
              includedCount: 1
            }
          }
        ]
      }
    }
  ]);

  return {
    month,
    year,
    totalBookings: report?.totals?.[0]?.count || 0,
    users: report?.users || []
  };
};
