import mongoose from 'mongoose';

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    console.log('[MongoDB] Using existing connection');
    return;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[MongoDB] MONGODB_URI not found in environment variables');
    throw new Error('MONGODB_URI is required');
  }

  try {
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(uri, options);
    isConnected = true;

    console.log('[MongoDB] Connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected');
      isConnected = false;
    });

  } catch (error) {
    console.error('[MongoDB] Failed to connect:', error.message);
    throw error;
  }
}

export function getConnection() {
  return mongoose.connection;
}

export default { connectDB, getConnection };
