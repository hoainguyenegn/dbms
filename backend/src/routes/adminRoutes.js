import { Router } from 'express';
import { verifyToken, requireManager } from '../middlewares/authMiddleware.js';
import {
  getAdminEvents,
  getAdminEventDetail,
  updateShowing,
  updateTicketType,
  createEvent,
  updateEvent,
  deleteEvent,
  publishEvent,
  closeEvent,
  createShowing,
  deleteShowing,
  createTicketType,
  deleteTicketType,
} from '../controllers/adminEventController.js';

const router = Router();

// Toàn bộ các route /api/admin/* đều yêu cầu Xác thực (verifyToken) và Quyền Quản lý (requireManager)
router.use(verifyToken, requireManager);

// F01: Quản lý sự kiện
router.get('/events', getAdminEvents);
router.get('/events/:id', getAdminEventDetail);
router.post('/events', createEvent);
router.patch('/events/:id', updateEvent);
router.delete('/events/:id', deleteEvent);
router.post('/events/:id/publish', publishEvent);
router.post('/events/:id/close', closeEvent);

// F02: Quản lý suất diễn
router.post('/events/:id/showings', createShowing);
router.patch('/showings/:id', updateShowing);
router.delete('/showings/:id', deleteShowing);

// F02: Quản lý loại vé
router.post('/showings/:id/ticket-types', createTicketType);
router.patch('/ticket-types/:id', updateTicketType);
router.delete('/ticket-types/:id', deleteTicketType);

// Scoped URLs reject child IDs that belong to a different parent.
router.patch('/events/:eventId/showings/:id', updateShowing);
router.delete('/events/:eventId/showings/:id', deleteShowing);
router.patch('/showings/:showingId/ticket-types/:id', updateTicketType);
router.delete('/showings/:showingId/ticket-types/:id', deleteTicketType);

export default router;
