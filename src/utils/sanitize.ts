/**
 * Sanitization utilities for backend to prevent XSS and injection attacks
 */

// Dangerous characters that could be used for XSS or injection attacks
const DANGEROUS_CHARS = /[<>\"'&]/g;
const SCRIPT_TAGS = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const JAVASCRIPT_PROTOCOL = /javascript:/gi;
const DATA_PROTOCOL = /data:/gi;

/**
 * Sanitizes a string by removing dangerous characters and patterns
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  let sanitized = input;
  
  // Remove script tags
  sanitized = sanitized.replace(SCRIPT_TAGS, '');
  
  // Remove dangerous protocols
  sanitized = sanitized.replace(JAVASCRIPT_PROTOCOL, '');
  sanitized = sanitized.replace(DATA_PROTOCOL, '');
  
  // Remove dangerous characters
  sanitized = sanitized.replace(DANGEROUS_CHARS, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

/**
 * Sanitizes name input
 * - Removes dangerous characters
 * - Truncates to 100 characters
 */
export const sanitizeName = (name: string): string => {
  const sanitized = sanitizeString(name);
  return sanitized.substring(0, 100);
};

/**
 * Sanitizes email input
 * - Removes dangerous characters
 * - Truncates to 200 characters
 * - Normalizes to lowercase
 */
export const sanitizeEmail = (email: string): string => {
  const sanitized = sanitizeString(email.trim().toLowerCase());
  return sanitized.substring(0, 200);
};

