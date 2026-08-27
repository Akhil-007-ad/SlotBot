import User from '../models/User.js';

export const getCurrentUser = user => ({
  id: user.id,
  email: user.email,
  name: user.name,
  department: user.department,
  isAdmin: user.isAdmin
});

export const synchronizeDirectoryUsers = async users => {
  if (users.length) {
    await User.bulkWrite(users.map(user => ({
      updateOne: {
        filter: { entraId: user.id },
        update: {
          $set: {
            email: user.email?.toLowerCase() || null,
            name: user.name || 'SlotBot user',
            department: user.department || ''
          },
          $setOnInsert: { isAdmin: false }
        },
        upsert: true
      }
    })));
  }

  const localUsers = await User.find({ entraId: { $in: users.map(user => user.id) } })
    .select('entraId isAdmin');
  const adminById = new Map(localUsers.map(user => [user.entraId, user.isAdmin]));
  return users.map(user => ({ ...user, isAdmin: adminById.get(user.id) || false }));
};

export const setAdminStatus = async (entraId, isAdmin) => {
  if (!isAdmin) {
    const target = await User.findOne({ entraId });
    if (!target) return null;
    if (target.isAdmin && await User.countDocuments({ isAdmin: true }) <= 1) {
      const error = new Error('The last remaining administrator cannot be demoted.');
      error.status = 409;
      throw error;
    }
  }

  return User.findOneAndUpdate(
    { entraId },
    { $set: { isAdmin } },
    { new: true }
  ).select('entraId email name department isAdmin');
};

export const listAdmins = () => User.find({ isAdmin: true })
  .select('entraId email name department isAdmin')
  .sort({ name: 1, email: 1 })
  .lean();

export const grantAdminByEmail = async email => {
  const normalizedEmail = email.toLowerCase();
  return User.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: { isAdmin: true },
      $setOnInsert: {
        entraId: `pending:${normalizedEmail}`,
        email: normalizedEmail,
        name: normalizedEmail,
        department: ''
      }
    },
    { new: true, upsert: true }
  ).select('entraId email name department isAdmin');
};

export const revokeAdminByEmail = async email => {
  const normalizedEmail = email.toLowerCase();
  const target = await User.findOne({ email: normalizedEmail });
  if (!target || !target.isAdmin) return null;
  if (await User.countDocuments({ isAdmin: true }) <= 1) {
    const error = new Error('The last remaining administrator cannot be removed.');
    error.status = 409;
    throw error;
  }
  target.isAdmin = false;
  await target.save();
  return target;
};
