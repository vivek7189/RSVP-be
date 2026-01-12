import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';


export const calculateTokenExpiry = (): Date => {
  const eventDate = process.env.EVENT_DATE
    ? new Date(process.env.EVENT_DATE)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 

  const gracePeriodDays = parseInt(process.env.TOKEN_GRACE_PERIOD_DAYS || '7');
  const expiryDate = new Date(eventDate);
  expiryDate.setDate(expiryDate.getDate() + gracePeriodDays);

  return expiryDate;
};

export const generateToken = (email: string): { token: string; expiresAt: Date } => {
  const expiresAt = calculateTokenExpiry();
  const expiresInSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

  const minExpirySeconds = 24 * 60 * 60; 
  const finalExpirySeconds = Math.max(expiresInSeconds, minExpirySeconds);

  if (expiresInSeconds < 0) {
    console.warn(`Warning: EVENT_DATE is in the past. Using minimum token expiry of 1 day.`);
  }

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: finalExpirySeconds });

  return { token, expiresAt };
};

export const verifyToken = (token: string): { email: string } | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    return decoded;
  } catch (error) {
    return null;
  }
};

export const isTokenExpired = (expiresAt: Date): boolean => {
  return new Date() > new Date(expiresAt);
};
