import { mysqlPool } from '../config/database.js';
import { getAdminStats } from '../services/statsService.js';

export const getStats = async (request, response) => {
  try {
    const result = await getAdminStats(mysqlPool);
    return response.json({
      success: true,
      source: result.source,
      stats: result.data,
    });
  } catch (error) {
    console.error('Lỗi tại statsController:', error);
    // Trả về dữ liệu rỗng an toàn thay vì ném lỗi 500
    return response.json({
      success: true,
      source: 'fallback',
      stats: {
        confirmedTickets: 0,
        totalRevenueVnd: 0,
        unbookedShowings: []
      }
    });
  }
};