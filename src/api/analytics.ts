import { apiClient } from './client';
import {
  MachineIntervalsRequest,
  MachineIntervalsData,
  CycleTimeRequest,
  CycleTimeHourlyBucket,
} from '../types/analytics';

export async function getMachineIntervals(
  request: MachineIntervalsRequest
): Promise<MachineIntervalsData> {
  return (await apiClient.post(
    '/analytics-query/machine-intervals',
    request
  )) as unknown as MachineIntervalsData;
}

export async function getCycleTimeMetrics(
  request: CycleTimeRequest
): Promise<CycleTimeHourlyBucket[]> {
  return (await apiClient.post(
    '/analytics-query',
    request
  )) as unknown as CycleTimeHourlyBucket[];
}
