import { mysqlPool } from '../config/database.js';
import { getAdminStats } from '../services/statsService.js';

export const getStats = async (request, response, next) => {
  try {
    const result = await getAdminStats(mysqlPool, request.query);
    return response.json({ success: true, source: result.source, stats: result.data });
  } catch (error) {
    next(error);
  }
};
