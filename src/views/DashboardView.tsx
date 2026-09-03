import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Alert,
  Button,
  Fab,
  Tooltip,
  Fade,
} from '@mui/material';
import { SmartToy as BotIcon } from '@mui/icons-material';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AppHeader } from '../components/common/AppHeader';
import { FilterBar } from '../components/filters/FilterBar';
import { TimelineSection } from '../components/chart/TimelineSection';
import { HourlySummaryTable } from '../components/table/HourlySummaryTable';
import { DashboardSkeleton } from '../components/common/DashboardSkeleton';
import { getAssetTree, flattenAssetTree } from '../api/assets';
import { getShifts, parseShiftIntervals } from '../api/shifts';
import { getMachineIntervals, getCycleTimeMetrics } from '../api/analytics';
import { FlattenedAsset } from '../types/asset';
import { ParsedShiftInterval } from '../types/shift';
import { buildShiftWindowUtc, formatShiftRangeBadge } from '../utils/timezone';
import { buildHourlyColumns, aggregateHourlyData } from '../utils/segmentSlicer';

export const DashboardView: React.FC = () => {
  // Filter States
  const [selectedLevel, setSelectedLevel] = useState<number | 'all'>('all');
  const [selectedAsset, setSelectedAsset] = useState<FlattenedAsset | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<FlattenedAsset | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('2026-06-25');
  const [selectedShift, setSelectedShift] = useState<ParsedShiftInterval | null>(null);

  // Auto Refresh States
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30);

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

  // Set default asset (prefer Line 1 or first line)
  useEffect(() => {
    if (!selectedAsset && flattenedAssets.length > 0) {
      const lineNode =
        flattenedAssets.find((a) => a.name.toLowerCase() === 'line 1' || a.assetlevel_id === 20) ||
        flattenedAssets[0];
      setSelectedAsset(lineNode);
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

  // Active target asset for API: if machine is selected use machine, else use selected line/asset
  const activeEntity = selectedMachine || selectedAsset;

  // 3. Compute Time Range in UTC and IST
  const shiftWindow = useMemo(() => {
    if (!selectedShift) return null;
    return buildShiftWindowUtc(selectedDate, selectedShift.startTime, selectedShift.endTime);
  }, [selectedDate, selectedShift]);

  // 4. Fetch Machine Intervals (Timeline & Segments)
  const intervalsQueryKey = [
    'machineIntervals',
    activeEntity?.id,
    activeEntity?.assetlevel_id,
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
      if (!activeEntity || !shiftWindow) return null;
      return getMachineIntervals({
        entity_scope: {
          type: 'asset',
          asset: {
            asset_id: activeEntity.id,
            asset_level_id: activeEntity.assetlevel_id,
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
    enabled: Boolean(activeEntity && shiftWindow),
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  // 5. Fetch Cycle Time Metrics (for Table)
  const cycleTimesQueryKey = [
    'cycleTimes',
    activeEntity?.id,
    activeEntity?.assetlevel_id,
    shiftWindow?.from_ts,
    shiftWindow?.to_ts,
  ];

  const {
    data: cycleTimesData,
    refetch: refetchCycleTimes,
  } = useQuery({
    queryKey: cycleTimesQueryKey,
    queryFn: () => {
      if (!activeEntity || !shiftWindow) return null;
      return getCycleTimeMetrics({
        entity_scope: {
          type: 'asset',
          asset: {
            asset_id: activeEntity.id,
            asset_level_id: activeEntity.assetlevel_id,
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
    enabled: Boolean(activeEntity && shiftWindow),
    placeholderData: keepPreviousData,
    retry: 2,
  });

  // Handle Manual Refresh
  const handleRefresh = async () => {
    await Promise.all([refetchIntervals(), refetchCycleTimes()]);
  };

  // Auto Refresh Polling Effect
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const intervalMs = autoRefreshInterval * 1000;
    const timer = setInterval(() => {
      handleRefresh();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled, autoRefreshInterval, handleRefresh]);

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

  const isInitialLoading = !intervalsData && (isLoadingAssets || isLoadingShifts || isLoadingIntervals);
  const activeError = assetError || shiftError || intervalsError;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#f8fafc', position: 'relative' }}>
      <AppHeader />

      <Container maxWidth="xl" sx={{ py: 3, px: { xs: 2, md: 3 } }}>
        {/* Filter Bar with Cascading Selectors */}
        <FilterBar
          assets={flattenedAssets}
          selectedLevel={selectedLevel}
          selectedAsset={selectedAsset}
          selectedMachine={selectedMachine}
          selectedDate={selectedDate}
          selectedShift={selectedShift}
          shifts={parsedShifts}
          shiftBadgeLabel={shiftBadgeLabel}
          partModelLabel={partModelLabel}
          isRefreshing={isFetchingIntervals}
          autoRefreshEnabled={autoRefreshEnabled}
          autoRefreshInterval={autoRefreshInterval}
          onLevelChange={setSelectedLevel}
          onAssetChange={(asset) => {
            setSelectedAsset(asset);
            setSelectedMachine(null); // Reset machine selection when asset changes
          }}
          onMachineChange={setSelectedMachine}
          onDateChange={setSelectedDate}
          onShiftChange={setSelectedShift}
          onToggleAutoRefresh={setAutoRefreshEnabled}
          onAutoRefreshIntervalChange={setAutoRefreshInterval}
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

        {/* Loading State Skeleton or Smooth Loaded Content */}
        {isInitialLoading ? (
          <DashboardSkeleton />
        ) : (
          <Fade in timeout={350}>
            <Box>
              {/* Timeline Section */}
              {shiftWindow && (
                <TimelineSection
                  intervals={intervalsData}
                  windowStartUtc={shiftWindow.from_ts}
                  windowEndUtc={shiftWindow.to_ts}
                  showIndividualProduces={showIndividualProduces}
                  showPointLabels={showPointLabels}
                  isFetching={isFetchingIntervals}
                  onToggleIndividualProduces={setShowIndividualProduces}
                  onTogglePointLabels={setShowPointLabels}
                />
              )}

              {/* Hourly Summary Table */}
              <HourlySummaryTable
                columns={hourlyColumns}
                metrics={hourlyMetrics}
                isFetching={isFetchingIntervals}
              />
            </Box>
          </Fade>
        )}
      </Container>

      {/* Floating Action Bot Icon (matching bottom right in Mockup 4) */}
      <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }}>
        <Tooltip title="MES Copilot Assistant">
          <Fab
            size="medium"
            sx={{
              backgroundColor: '#1e1b4b',
              color: '#ffffff',
              '&:hover': { backgroundColor: '#312e81' },
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
            }}
          >
            <BotIcon />
          </Fab>
        </Tooltip>
      </Box>
    </Box>
  );
};
