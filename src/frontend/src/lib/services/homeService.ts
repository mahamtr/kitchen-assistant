import { apiGet } from '../api';
import type { HomeTodayResponse } from '../types/contracts';

async function getToday(): Promise<HomeTodayResponse> {
  return apiGet('/home/today');
}

export const homeService = {
  getToday,
};

export default homeService;
