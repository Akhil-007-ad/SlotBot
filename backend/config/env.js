import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5001),
  mongoUri: process.env.MONGODB_URI,
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
};
