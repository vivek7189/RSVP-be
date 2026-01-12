import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import pool from '../config/database';
import { generateToken, isTokenExpired, verifyToken } from '../utils/jwt';
import { getCachedRSVPs, setCachedRSVPs, invalidateRSVPCache } from '../utils/cache';
import { sendCancellationEmail } from '../utils/email';
import { sanitizeName, sanitizeEmail } from '../utils/sanitize';
import { RSVPPublic } from '../types';
import { AuthRequest } from '../middleware/auth';

export const createRSVP = async (req: Request, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

 
  const { name: rawName, email: rawEmail } = req.body;
  const name = sanitizeName(rawName);
  const email = sanitizeEmail(rawEmail);
  
  
  if (!name || name.length < 2 || name.length > 100) {
    res.status(400).json({ error: 'Invalid name provided' });
    return;
  }
  
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    res.status(400).json({ error: 'Invalid email provided' });
    return;
  }

  try {
    const { token, expiresAt } = generateToken(email);

    const result = await pool.query(
      'INSERT INTO rsvps (name, email, token, token_expires_at) VALUES ($1, $2, $3, $4) RETURNING id, name, email, created_at',
      [name, email, token, expiresAt]
    );

    await invalidateRSVPCache();

    sendCancellationEmail(email, name, token)
      .catch(error => {
        console.error('Failed to send cancellation email:', error);
      });

    res.status(201).json({
      rsvp: result.rows[0],
      token: token,
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Email already registered for this event' });
      return;
    }
    console.error('Error creating RSVP:', error);
    res.status(500).json({ error: 'Failed to create RSVP' });
  }
};

export const getAllRSVPs = async (req: Request, res: Response): Promise<void> => {
  try {
    const cached = await getCachedRSVPs();
    if (cached) {
      res.json(cached);
      return;
    }

    const result = await pool.query(
      'SELECT id, name, email, created_at FROM rsvps ORDER BY created_at DESC'
    );

    const rsvps: RSVPPublic[] = result.rows;

    await setCachedRSVPs(rsvps);

    res.json(rsvps);
  } catch (error) {
    console.error('Error fetching RSVPs:', error);
    res.status(500).json({ error: 'Failed to fetch RSVPs' });
  }
};

export const updateRSVP = async (req: AuthRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }

  const { id } = req.params;
  const { name: rawName, email: rawEmail } = req.body;
  
  // Sanitize inputs
  const name = rawName ? sanitizeName(rawName) : undefined;
  const email = rawEmail ? sanitizeEmail(rawEmail) : undefined;
  
  const userEmail = req.userEmail;

  try {
    const checkResult = await pool.query(
      'SELECT email FROM rsvps WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'RSVP not found' });
      return;
    }

    if (checkResult.rows[0].email !== userEmail) {
      res.status(403).json({ error: 'Not authorized to update this RSVP' });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE rsvps SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, created_at`,
      values
    );

    await invalidateRSVPCache();

    res.json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }
    console.error('Error updating RSVP:', error);
    res.status(500).json({ error: 'Failed to update RSVP' });
  }
};

export const deleteRSVP = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userEmail = req.userEmail;

  try {
    const checkResult = await pool.query(
      'SELECT email, token_expires_at FROM rsvps WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      res.status(404).json({ error: 'RSVP not found' });
      return;
    }

    if (checkResult.rows[0].email !== userEmail) {
      res.status(403).json({ error: 'Not authorized to delete this RSVP' });
      return;
    }

    // Check if token has expired
    if (isTokenExpired(checkResult.rows[0].token_expires_at)) {
      res.status(410).json({ error: 'Cancellation link has expired. The event has already passed.' });
      return;
    }

    await pool.query('DELETE FROM rsvps WHERE id = $1', [id]);

    await invalidateRSVPCache();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting RSVP:', error);
    res.status(500).json({ error: 'Failed to delete RSVP' });
  }
};

export const verifyRSVPToken = async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token required' });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, token_expires_at, created_at FROM rsvps WHERE email = $1 AND token = $2',
      [decoded.email, token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'RSVP not found' });
      return;
    }

    const rsvp = result.rows[0];

    
    if (isTokenExpired(rsvp.token_expires_at)) {
      res.status(410).json({ error: 'Cancellation link has expired. The event has already passed.' });
      return;
    }

    res.json({
      id: rsvp.id,
      name: rsvp.name,
      email: rsvp.email,
      created_at: rsvp.created_at,
    });
  } catch (error) {
    console.error('Error verifying RSVP token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
};

export const deleteRSVPByToken = async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token required' });
    return;
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, token_expires_at FROM rsvps WHERE email = $1 AND token = $2',
      [decoded.email, token]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'RSVP not found' });
      return;
    }

    const rsvp = result.rows[0];

    // Check if token has expired
    if (isTokenExpired(rsvp.token_expires_at)) {
      res.status(410).json({ error: 'Cancellation link has expired. The event has already passed.' });
      return;
    }

    await pool.query('DELETE FROM rsvps WHERE id = $1', [rsvp.id]);
    await invalidateRSVPCache();

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting RSVP by token:', error);
    res.status(500).json({ error: 'Failed to cancel RSVP' });
  }
};
