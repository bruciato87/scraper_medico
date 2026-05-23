import dotenv from 'dotenv';

// Load environment variables from the .env file in the root directory
dotenv.config();

const requiredEnv = ['RESEND_API_KEY', 'EMAIL_TO'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.warn(`[WARNING] Missing environment variables: ${missingEnv.join(', ')}. Please update your .env file.`);
}

export const config = {
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_TO: process.env.EMAIL_TO || '',
  CHECK_INTERVAL_MINUTES: parseInt(process.env.CHECK_INTERVAL_MINUTES || '15', 10)
};
