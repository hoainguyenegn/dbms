import { Router } from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Placeholder cho F04, F05, F06, F08 (Phụ trách bởi Thành viên 2 và 3)
router.get('/bookings/my', verifyToken, (request, response) => {
  response.json({ bookings: [], userId: request.user.id });
});

export default router;

