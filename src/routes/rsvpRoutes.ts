import { Router } from 'express';
import {
  createRSVP,
  getAllRSVPs,
  updateRSVP,
  deleteRSVP,
  verifyRSVPToken,
  deleteRSVPByToken,
} from '../controllers/rsvpController';
import { createRSVPValidation, updateRSVPValidation } from '../utils/validation';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/rsvps', createRSVPValidation, createRSVP);
router.get('/rsvps', getAllRSVPs);


router.get('/rsvps/verify-token', verifyRSVPToken);
router.delete('/rsvps/cancel-by-token', deleteRSVPByToken);

// Parameterized routes - must come after specific routes
router.put('/rsvps/:id', authenticateToken, updateRSVPValidation, updateRSVP);
router.delete('/rsvps/:id', authenticateToken, deleteRSVP);

export default router;
