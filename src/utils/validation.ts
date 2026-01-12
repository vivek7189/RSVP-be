import { body } from 'express-validator';
import { sanitizeName, sanitizeEmail } from './sanitize';


const customSanitize = (value: any) => {
  if (typeof value !== 'string') return '';
  return value;
};

export const createRSVPValidation = [
  body('name')
    .trim()
    .customSanitizer((value) => sanitizeName(value))
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes')
    .custom((value) => {

      const dangerousPatterns = /[<>\"'&]|<script|javascript:|data:/i;
      if (dangerousPatterns.test(value)) {
        throw new Error('Name contains invalid characters');
      }
      return true;
    }),

  body('email')
    .trim()
    .customSanitizer((value) => sanitizeEmail(value))
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 200 })
    .withMessage('Email must not exceed 200 characters')
    .custom((value) => {
      const dangerousPatterns = /<script|javascript:|data:/i;
      if (dangerousPatterns.test(value)) {
        throw new Error('Email contains invalid characters');
      }
      return true;
    }),
];

export const updateRSVPValidation = [
  body('name')
    .optional()
    .trim()
    .customSanitizer((value) => sanitizeName(value))
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes')
    .custom((value) => {
      if (value) {
        const dangerousPatterns = /[<>\"'&]|<script|javascript:|data:/i;
        if (dangerousPatterns.test(value)) {
          throw new Error('Name contains invalid characters');
        }
      }
      return true;
    }),

  body('email')
    .optional()
    .trim()
    .customSanitizer((value) => sanitizeEmail(value))
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 200 })
    .withMessage('Email must not exceed 200 characters')
    .custom((value) => {
      if (value) {
        const dangerousPatterns = /<script|javascript:|data:/i;
        if (dangerousPatterns.test(value)) {
          throw new Error('Email contains invalid characters');
        }
      }
      return true;
    }),
];
