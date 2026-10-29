import { Router } from 'express';
import { getPublicEvents, getPublicEventDetail } from '../controllers/eventController.js';

const router = Router();

// F03: Tìm kiếm danh sách sự kiện công khai
router.get('/events', getPublicEvents);

// F03: Xem chi tiết sự kiện, suất diễn và tồn vé khả dụng thời gian thực
router.get('/events/:id', getPublicEventDetail);

export default router;
