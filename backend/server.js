import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import chatRoutes from './routes/chatRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import roomRoutes from './routes/roomRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
app.use(cors({ origin: config.frontendOrigin }));
app.use(express.json());
app.use('/api/chat', chatRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms', roomRoutes);
app.get('/health', (req, res) => res.send('Server is healthy'));
app.use(errorHandler);

await connectDatabase();
app.listen(config.port, () => console.log(`Server running on http://localhost:${config.port}`));
