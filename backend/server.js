import app from './app.js';
import { config, validateConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';

let server;
let shuttingDown = false;

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; shutting down.`);

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  if (server) await new Promise(resolve => server.close(resolve));
  await disconnectDatabase();
  process.exit(exitCode);
};

try {
  validateConfig();
  await connectDatabase();
  server = app.listen(config.port, () => console.log(`SlotBot API listening on port ${config.port}.`));
} catch (error) {
  console.error('SlotBot failed to start:', error.message);
  process.exit(1);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  void shutdown('uncaughtException', 1);
});
