import mongoose from 'mongoose';
import { config } from './env.js';

export const connectDatabase = async () => {
  if (!config.mongoUri) throw new Error('MONGODB_URI is not configured.');
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20
  });
  console.log('MongoDB connection established.');
};

export const disconnectDatabase = () => mongoose.disconnect();
