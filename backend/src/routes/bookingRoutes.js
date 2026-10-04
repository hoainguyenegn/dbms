import { Router } from 'express';
import { cancel, confirm, detail, history } from '../controllers/bookingController.js';
import { requireAuth, requireCustomer } from '../middlewares/authenticate.js';

const router = Router();

router.use(requireAuth, requireCustomer);
router.post('/bookings/confirm', confirm);
router.post('/reservations/:reservationId/confirm', confirm);
router.get('/bookings/my', history);
router.get('/bookings/:bookingCode', detail);
router.post('/bookings/:bookingCode/cancel', cancel);
router.get('/me/bookings', history);
router.get('/me/bookings/:bookingCode', detail);
router.post('/me/bookings/:bookingCode/cancel', cancel);

export default router;