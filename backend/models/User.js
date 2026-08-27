import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  entraId: {
    type: String,
    default: undefined,
    unique: true,
    sparse: true,
    trim: true
  },
  email: {
    type: String,
    default: null,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    default: 'SlotBot user',
    trim: true
  },
  department: {
    type: String,
    default: '',
    trim: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const User = mongoose.model('User', userSchema);

export default User;
