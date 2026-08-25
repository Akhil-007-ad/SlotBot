import dns from 'node:dns';
import mongoose from 'mongoose';
import { config } from './env.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);

export const connectDatabase = async () => {
  if (!config.mongoUri) throw new Error('MONGODB_URI is not configured.');
  const connection = await mongoose.connect(config.mongoUri);
  console.log(`MongoDB connected: ${connection.connection.host}`);
};
