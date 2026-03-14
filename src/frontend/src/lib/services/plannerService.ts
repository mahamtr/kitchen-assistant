import { apiGet, apiPost } from '../api';
import type {
  CreatePlannerRevisionPayload,
  GroceryPreviewResponse,
  WeeklyPlanResponse,
  WeeklyPlanRevisionResponse,
} from '../types/contracts';

async function getCurrentPlan(): Promise<WeeklyPlanResponse> {
  return apiGet('/weekly-plans/current');
}

async function getGroceryPreview(): Promise<GroceryPreviewResponse> {
  const plan = await getCurrentPlan();
  return apiGet(`/weekly-plans/${plan.id}/grocery-preview`);
}

async function getRevisions(): Promise<WeeklyPlanRevisionResponse[]> {
  const plan = await getCurrentPlan();
  return apiGet(`/weekly-plans/${plan.id}/revisions`);
}

async function getLatestRevision(): Promise<WeeklyPlanRevisionResponse> {
  const plan = await getCurrentPlan();
  return apiGet(`/weekly-plans/${plan.id}/revisions/latest`);
}

async function createRevision(payload: CreatePlannerRevisionPayload): Promise<WeeklyPlanRevisionResponse> {
  const plan = await getCurrentPlan();
  return apiPost(`/weekly-plans/${plan.id}/revisions`, payload);
}

async function acceptRevision(revisionId: string): Promise<WeeklyPlanResponse> {
  const plan = await getCurrentPlan();
  return apiPost(`/weekly-plans/${plan.id}/revisions/${revisionId}/accept`);
}

async function generateCurrent(): Promise<WeeklyPlanResponse> {
  return apiPost('/weekly-plans/current/generate');
}

export const plannerService = {
  acceptRevision,
  createRevision,
  generateCurrent,
  getCurrentPlan,
  getGroceryPreview,
  getLatestRevision,
  getRevisions,
};

export default plannerService;
