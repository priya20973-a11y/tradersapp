import mongoose from "mongoose";

export function getMongoUri() {
  const uri = process.env.MONGODB_URI ?? process.env.MONGODB_URL;
  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI or MONGODB_URL. Add the MongoDB connection string to your environment before using database-backed features.",
    );
  }
  return uri;
}

export async function connectToDatabase() {
  if (!process.env.MONGODB_URI && !process.env.MONGODB_URL) {
    throw new Error(
      "Missing MONGODB_URI or MONGODB_URL. Configure the environment before connecting to MongoDB.",
    );
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  return mongoose.connect(getMongoUri());
}
