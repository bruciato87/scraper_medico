import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the .env file in the root directory
dotenv.config();

const requiredEnv = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_TO'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.warn(`[WARNING] Missing environment variables: ${missingEnv.join(', ')}. Please update your .env file.`);
}

export const config = {
  EMAIL_HOST: process.env.EMAIL_HOST || '',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587', 10),
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  EMAIL_TO: process.env.EMAIL_TO || '',
  CHECK_INTERVAL_MINUTES: parseInt(process.env.CHECK_INTERVAL_MINUTES || '15', 10)
};
