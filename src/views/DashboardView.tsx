import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Alert,
  Button,
  Skeleton,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { AppHeader } from '../components/common/AppHeader';
import { FilterBar } from '../components/filters/FilterBar';
import { TimelineSection } from '../components/chart/TimelineSection';
import { HourlySummaryTable } from '../components/table/HourlySummaryTable';
import { getAssetTree, flattenAssetTree } from '../api/assets';
import { getShifts, parseShiftIntervals } from '../api/shifts';
import { getMachineIntervals, getCycleTimeMetrics } from '../api/analytics';
import { FlattenedAsset } from '../types/asset';
import { ParsedShiftInterval } from '../types/shift';
import { buildShiftWindowUtc, formatShiftRangeBadge } from '../utils/timezone';
import { buildHourlyColumns, aggregateHourlyData } from '../utils/segmentSlicer';

export const DashboardView: React.FC = () => {

  // Filter States
  const [selectedAsset, setSelectedAsset] = useState<FlattenedAsset | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('2026-06-23');
  const [selectedShift, setSelectedShift] = useState<ParsedShiftInterval | null>(null);

  // Chart Toggle States
  const [showIndividualProduces, setShowIndividualProduces] = useState<boolean>(false);
  const [showPointLabels, setShowPointLabels] = useState<boolean>(true);

  // 1. Fetch Asset Tree
  const {
    data: assetTree = [],
    isLoading: isLoadingAssets,
    error: assetError,
  } = useQuery({
    queryKey: ['assetTree'],
    queryFn: getAssetTree,
    staleTime: 1000 * 60 * 10,
  });

  const flattenedAssets = useMemo(() => flattenAssetTree(assetTree), [assetTree]);

  // Set default asset (prefer a machine or line, e.g. Line 1 or first item)
  useEffect(() => {
    if (!selectedAsset && flattenedAssets.length > 0) {
      // Look for a node with codename or level 20 / 10
      const lineOrMachine =
        flattenedAssets.find((a) => a.assetlevel_id === 20 || a.assetlevel_id === 10) ||
        flattenedAssets[0];
      setSelectedAsset(lineOrMachine);
    }
  }, [flattenedAssets, selectedAsset]);

  // 2. Fetch Shifts
  const {
    data: rawShifts = [],
    isLoading: isLoadingShifts,
    error: shiftError,
  } = useQuery({
    queryKey: ['shifts'],
    queryFn: getShifts,
    staleTime: 1000 * 60 * 10,
  });

  const parsedShifts = useMemo(() => parseShiftIntervals(rawShifts), [rawShifts]);

  // Set default shift
  useEffect(() => {
    if (!selectedShift && parsedShifts.length > 0) {
      setSelectedShift(parsedShifts[0]);
    }
  }, [parsedShifts, selectedShift]);

  // 3. Compute Time Range in UTC and IST
  const shiftWindow = useMemo(() => {
    if (!selectedShift) return null;
    return buildShiftWindowUtc(selectedDate, selectedShift.startTime, selectedShift.endTime);
  }, [selectedDate, selectedShift]);

  // 4. Fetch Machine Intervals (Timeline & Segments)
  const intervalsQueryKey = [
    'machineIntervals',
    selectedAsset?.id,
    selectedAsset?.assetlevel_id,
    shiftWindow?.from_ts,
    shiftWindow?.to_ts,
    showIndividualProduces,
  ];

  const {
    data: intervalsData,
    isLoading: isLoadingIntervals,
    isFetching: isFetchingIntervals,
    error: intervalsError,
    refetch: refetchIntervals,
  } = useQuery({
    queryKey: intervalsQueryKey,
    queryFn: () => {
      if (!selectedAsset || !shiftWindow) return null;
      return getMachineIntervals({
        entity_scope: {
          type: 'asset',
          asset: {
            asset_id: selectedAsset.id,
            asset_level_id: selectedAsset.assetlevel_id,
          },
        },
        time_range: {
          from_ts: shiftWindow.from_ts,
          to_ts: shiftWindow.to_ts,
        },
        produce_counts: true,
        exact_produces: showIndividualProduces,
        group_produce_counts_by_part_model: true,
      });
    },
    enabled: Boolean(selectedAsset && shiftWindow),
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // 5. Fetch Cycle Time Metrics (for Table)
  const cycleTimesQueryKey = [
    'cycleTimes',
    selectedAsset?.id,
    selectedAsset?.assetlevel_id,
    shiftWindow?.from_ts,
    shiftWindow?.to_ts,
  ];

  const {
    data: cycleTimesData,
    refetch: refetchCycleTimes,
  } = useQuery({
    queryKey: cycleTimesQueryKey,
    queryFn: () => {
      if (!selectedAsset || !shiftWindow) return null;
      return getCycleTimeMetrics({
        entity_scope: {
          type: 'asset',
          asset: {
            asset_id: selectedAsset.id,
            asset_level_id: selectedAsset.assetlevel_id,
          },
        },
        metrics: ['ideal_cycle_time_seconds', 'actual_cycle_time_seconds'],
        time_range: {
          from_ts: shiftWindow.from_ts,
          to_ts: shiftWindow.to_ts,
        },
        distribution: 'hourly',
      });
    },
    enabled: Boolean(selectedAsset && shiftWindow),
    retry: 2,
  });

  // Handle Manual Refresh
  const handleRefresh = async () => {
    await Promise.all([refetchIntervals(), refetchCycleTimes()]);
  };

  // 6. Build Hourly Columns & Aggregated Table Metrics
  const hourlyColumns = useMemo(() => {
    if (!shiftWindow) return [];
    return buildHourlyColumns(shiftWindow.startIst, shiftWindow.endIst);
  }, [shiftWindow]);

  const hourlyMetrics = useMemo(() => {
    return aggregateHourlyData(hourlyColumns, intervalsData, cycleTimesData);
  }, [hourlyColumns, intervalsData, cycleTimesData]);

  // Shift badge formatted label
  const shiftBadgeLabel = useMemo(() => {
    if (!shiftWindow) return 'Selecting shift...';
    return formatShiftRangeBadge(shiftWindow.startIst, shiftWindow.endIst);
  }, [shiftWindow]);

  // First part model label if available
  const partModelLabel = useMemo(() => {
    if (intervalsData?.produce_counts && intervalsData.produce_counts.length > 0) {
      const pm = intervalsData.produce_counts[0].part_model_id;
      return pm.length > 10 ? `${pm.slice(0, 8)}...` : pm;
    }
    return undefined;
  }, [intervalsData?.produce_counts]);

  const isInitialLoading =
    isLoadingAssets || isLoadingShifts || (isLoadingIntervals && !intervalsData);
  const activeError = assetError || shiftError || intervalsError;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      <AppHeader />

      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, md: 3 } }}>
        {/* Filter Bar */}
        <FilterBar
          assets={flattenedAssets}
          assetTree={assetTree}
          shifts={parsedShifts}
          selectedAsset={selectedAsset}
          selectedDate={selectedDate}
          selectedShift={selectedShift}
          shiftBadgeLabel={shiftBadgeLabel}
          partModelLabel={partModelLabel}
          isRefreshing={isFetchingIntervals}
          onAssetChange={setSelectedAsset}
          onDateChange={setSelectedDate}
          onShiftChange={setSelectedShift}
          onRefresh={handleRefresh}
        />

        {/* Global Error Banner with Retry */}
        {activeError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={handleRefresh}>
                Retry
              </Button>
            }
            sx={{ mb: 3, borderRadius: 2 }}
          >
            Failed to load dashboard data: {(activeError as any)?.message || 'Network error'}
          </Alert>
        )}

        {/* Loading State Skeleton */}
        {isInitialLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Skeleton variant="rounded" height={340} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" height={400} sx={{ borderRadius: 2 }} />
          </Box>
        ) : (
          <>
            {/* Timeline Section */}
            {shiftWindow && (
              <TimelineSection
                intervals={intervalsData}
                windowStartUtc={shiftWindow.from_ts}
                windowEndUtc={shiftWindow.to_ts}
                showIndividualProduces={showIndividualProduces}
                showPointLabels={showPointLabels}
                onToggleIndividualProduces={setShowIndividualProduces}
                onTogglePointLabels={setShowPointLabels}
              />
            )}

            {/* Hourly Summary Table */}
            <HourlySummaryTable columns={hourlyColumns} metrics={hourlyMetrics} />
          </>
        )}
      </Container>
    </Box>
  );
};
