import { sanitizeName, sanitizeEmail } from './sanitize';

describe('Input Sanitization - XSS Protection', () => {
  describe('sanitizeName', () => {
    it('should remove script tags from name', () => {
      const maliciousInput = "John<script>alert('XSS')</script>Doe";
      const result = sanitizeName(maliciousInput);
      expect(result).toBe('JohnDoe');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    it('should remove dangerous HTML characters', () => {
      const maliciousInput = "John<>\"'&Doe";
      const result = sanitizeName(maliciousInput);
      expect(result).toBe('JohnDoe');
      expect(result).not.toMatch(/[<>\"'&]/);
    });

    it('should handle real-world XSS attack attempts', () => {
      const xssAttempts = [
        "<img src=x onerror=alert('XSS')>",
        "javascript:alert('XSS')",
        "<svg onload=alert('XSS')>",
        "data:text/html,<script>alert('XSS')</script>",
      ];

      xssAttempts.forEach(attack => {
        const result = sanitizeName(attack);
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('data:');
        expect(result).not.toContain("'");
        expect(result).not.toContain('"');
      });
    });

    it('should truncate names longer than 100 characters', () => {
      const longName = 'A'.repeat(150);
      const result = sanitizeName(longName);
      expect(result.length).toBe(100);
    });

    it('should preserve valid name characters (apostrophe removed for XSS protection)', () => {
      const validName = "John O'Brien-Smith";
      const result = sanitizeName(validName);
      expect(result).toBe("John OBrien-Smith");
      expect(result).not.toContain("'");
    });

    it('should handle empty and null inputs', () => {
      expect(sanitizeName('')).toBe('');
      expect(sanitizeName('   ')).toBe('');
    });

    it('should remove XSS characters from SQL injection attempts', () => {
      const sqlInjection = "Robert'; DROP TABLE rsvps; --";
      const result = sanitizeName(sqlInjection);
      expect(result).not.toContain("'");
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('"');
      expect(result).not.toContain('&');
    });
  });

  describe('sanitizeEmail', () => {
    it('should remove script tags from email', () => {
      const maliciousInput = "user<script>alert('XSS')</script>@example.com";
      const result = sanitizeEmail(maliciousInput);
      expect(result).toBe('user@example.com');
      expect(result).not.toContain('<script>');
    });

    it('should remove dangerous protocols', () => {
      const maliciousInputs = [
        "javascript:alert('XSS')@example.com",
        "data:text/html,<script>alert('XSS')</script>@example.com",
      ];

      maliciousInputs.forEach(input => {
        const result = sanitizeEmail(input);
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('data:');
      });
    });

    it('should normalize email to lowercase', () => {
      const email = "John.Doe@EXAMPLE.COM";
      const result = sanitizeEmail(email);
      expect(result).toBe('john.doe@example.com');
    });

    it('should truncate emails longer than 200 characters', () => {
      const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com';
      const result = sanitizeEmail(longEmail);
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it('should handle real-world email XSS attempts', () => {
      const xssEmails = [
        "user<script>@example.com",
        "user<img src=x onerror=alert(1)>@example.com",
        "user' OR '1'='1@example.com",
      ];

      xssEmails.forEach(email => {
        const result = sanitizeEmail(email);
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
        expect(result).not.toContain("'");
        expect(result).toMatch(/^[^@]+@[^@]+\.[^@]+$/);
      });
    });

    it('should preserve valid email format', () => {
      const validEmail = "john.doe+test@example.co.uk";
      const result = sanitizeEmail(validEmail);
      expect(result).toBe('john.doe+test@example.co.uk');
      expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('should handle emails with special characters', () => {
      const emails = [
        "user+tag@example.com",
        "user.name@example.com",
        "user_name@example-domain.com",
      ];

      emails.forEach(email => {
        const result = sanitizeEmail(email);
        expect(result).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      });
    });
  });
});

