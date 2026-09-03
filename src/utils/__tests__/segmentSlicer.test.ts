import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  buildHourlyColumns,
  aggregateHourlyData,
  categorizeSegment,
} from '../segmentSlicer';
import { MachineIntervalsData } from '../../types/analytics';

describe('Segment Slicer & Hourly Aggregator', () => {
  it('correctly categorizes different segment types', () => {
    expect(
      categorizeSegment({ type: 'planned', runtime_name: null }, 'runtime')
    ).toBe('runtime');

    expect(
      categorizeSegment({ type: 'unknown unplanned production', runtime_name: null }, 'runtime')
    ).toBe('unknown_unplanned_production');

    expect(
      categorizeSegment({ type: 'unknown', downtime_name: 'unknown' }, 'downtime')
    ).toBe('unknown_downtime');

    expect(
      categorizeSegment({ type: 'planned', downtime_name: 'Tea Break' }, 'downtime')
    ).toBe('planned_downtime');
  });

  it('builds 1-hour columns across shift window', () => {
    const start = dayjs('2026-06-23T08:30:00+05:30');
    const end = dayjs('2026-06-23T11:30:00+05:30');

    const columns = buildHourlyColumns(start, end);
    expect(columns.length).toBe(3);
    expect(columns[0].label).toBe('08:30 - 09:30');
    expect(columns[1].label).toBe('09:30 - 10:30');
    expect(columns[2].label).toBe('10:30 - 11:30');
  });

  it('slices a multi-hour segment across boundaries and aggregates correctly', () => {
    const startIst = dayjs('2026-06-23T08:00:00+05:30');
    const endIst = dayjs('2026-06-23T11:00:00+05:30');
    const columns = buildHourlyColumns(startIst, endIst);

    // Segment: 08:30 to 10:15 IST (1 hour 45 minutes = 105 mins total)
    // 08:00-09:00: 30 mins
    // 09:00-10:00: 60 mins
    // 10:00-11:00: 15 mins
    const segStartUtc = dayjs('2026-06-23T08:30:00+05:30').utc().toISOString();
    const segEndUtc = dayjs('2026-06-23T10:15:00+05:30').utc().toISOString();

    const mockData: MachineIntervalsData = {
      machine_ids: [1],
      runtimes: [
        {
          start_at: segStartUtc,
          end_at: segEndUtc,
          type: 'planned',
          runtime_name: null,
        },
      ],
      downtimes: [],
      stoppages: [],
      produce_counts: [
        {
          bucket_start: dayjs('2026-06-23T08:00:00+05:30').utc().toISOString(),
          part_model_id: 'model-1',
          ok_count: 20,
          ng_count: 2,
        },
      ],
    };

    const metrics = aggregateHourlyData(columns, mockData, []);

    expect(metrics[0].runtimeMins).toBe(30);
    expect(metrics[1].runtimeMins).toBe(60);
    expect(metrics[2].runtimeMins).toBe(15);

    // Check produce count aggregation
    expect(metrics[0].passProduces).toBe(20);
    expect(metrics[0].failProduces).toBe(2);
    expect(metrics[0].totalProduces).toBe(22);
  });
});
