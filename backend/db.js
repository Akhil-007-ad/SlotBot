import dns from "node:dns";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Set DNS servers before connecting
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const MONGODB_URI = process.env.MONGODB_URI;

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};