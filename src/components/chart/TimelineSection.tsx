import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  FormControlLabel,
  Switch,
  LinearProgress,
  Fade,
} from '@mui/material';
import { WarningAmber as WarningIcon } from '@mui/icons-material';
import { MachineIntervalsData } from '../../types/analytics';
import { TimelineLegend } from './TimelineLegend';
import { TimelineCanvas } from './TimelineCanvas';
import { formatDateTimeIst } from '../../utils/timezone';

interface TimelineSectionProps {
  intervals: MachineIntervalsData | null | undefined;
  windowStartUtc: string;
  windowEndUtc: string;
  showIndividualProduces: boolean;
  showPointLabels: boolean;
  isFetching?: boolean;
  onToggleIndividualProduces: (val: boolean) => void;
  onTogglePointLabels: (val: boolean) => void;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({
  intervals,
  windowStartUtc,
  windowEndUtc,
  showIndividualProduces,
  showPointLabels,
  isFetching,
  onToggleIndividualProduces,
  onTogglePointLabels,
}) => {
  // Extract unique part models
  const partModels = React.useMemo(() => {
    const models = new Set<string>();
    if (intervals?.produce_counts) {
      intervals.produce_counts.forEach((c) => {
        if (c.part_model_id) models.add(c.part_model_id);
      });
    }
    return Array.from(models);
  }, [intervals]);

  const displayPartModel = partModels.length > 0 ? (partModels[0].length > 10 ? `${partModels[0].slice(0, 6)}...` : partModels[0]) : 'D22';

  // Find last observed produce timestamp
  const lastProduceTimestamp = React.useMemo(() => {
    let latest: string | null = null;
    if (intervals?.produces) {
      for (const group of intervals.produces) {
        for (const p of group.produces || []) {
          if (!latest || p.first_seen_ts > latest) {
            latest = p.first_seen_ts;
          }
        }
      }
    } else if (intervals?.produce_counts && intervals.produce_counts.length > 0) {
      const sorted = [...intervals.produce_counts].sort((a, b) => b.bucket_start.localeCompare(a.bucket_start));
      latest = sorted[0].bucket_start;
    }
    return latest ? formatDateTimeIst(latest) : null;
  }, [intervals]);

  // Count unknown segments
  const unknownStats = React.useMemo(() => {
    let count = 0;
    let totalMinutes = 0;
    if (intervals?.downtimes) {
      for (const d of intervals.downtimes) {
        if (d.type === 'unknown') {
          count++;
          const duration = (new Date(d.end_at).getTime() - new Date(d.start_at).getTime()) / (60 * 1000);
          totalMinutes += duration;
        }
      }
    }
    return { count, minutes: Math.round(totalMinutes * 10) / 10 };
  }, [intervals]);

  return (
    <Fade in timeout={350}>
      <Card
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          mb: 3,
          position: 'relative',
          overflow: 'hidden',
          transition: 'opacity 250ms ease-in-out',
        }}
      >
        {isFetching && (
          <LinearProgress
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              zIndex: 10,
            }}
          />
        )}
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Row 1: Title on left, Color Chips on right (Mockup 3 & 4) */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 1.5,
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
            Production History
          </Typography>
          <TimelineLegend />
        </Box>

        {/* Row 2: Part Models + Toggles */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2.5,
            mb: 1.5,
          }}
        >
          {/* Part Model indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>
              Part Models:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: '#1976d2',
                }}
              />
              <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                {displayPartModel}
              </Typography>
            </Box>
          </Box>

          {/* Individual Produces Legend (when toggle is ON) */}
          {showIndividualProduces && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#64748b',
                  }}
                />
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                  OK
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#e11d48', fontWeight: 800, fontSize: '0.85rem', lineHeight: 1 }}>
                  ✕
                </Typography>
                <Typography variant="caption" sx={{ color: '#e11d48', fontWeight: 700 }}>
                  FAIL
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem', lineHeight: 1 }}>
                  ▲
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                  WIP
                </Typography>
              </Box>
            </Box>
          )}

          {/* Toggles */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: { sm: 'auto' } }}>
            {!showIndividualProduces && (
              <FormControlLabel
                control={
                  <Switch
                    checked={showPointLabels}
                    onChange={(e) => onTogglePointLabels(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>
                    Point labels
                  </Typography>
                }
                sx={{ mr: 0 }}
              />
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={showIndividualProduces}
                  onChange={(e) => onToggleIndividualProduces(e.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>
                  Show Individual produces
                </Typography>
              }
              sx={{ mr: 0 }}
            />
          </Box>
        </Box>

        {/* Chart Canvas Area */}
        <Box
          sx={{
            borderRadius: 1.5,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            mb: 2,
          }}
        >
          <TimelineCanvas
            intervals={intervals}
            windowStartUtc={windowStartUtc}
            windowEndUtc={windowEndUtc}
            showIndividualProduces={showIndividualProduces}
            showPointLabels={showPointLabels}
          />
        </Box>

        {/* Help & Instruction Pills */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Box
            sx={{
              px: 1.2,
              py: 0.3,
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              bgcolor: '#f8fafc',
              fontSize: '0.725rem',
              color: '#475569',
            }}
          >
            Shift + drag to zoom into a time range · double-click to reset
          </Box>
          <Box
            sx={{
              px: 1.2,
              py: 0.3,
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              bgcolor: '#f8fafc',
              fontSize: '0.725rem',
              color: '#475569',
            }}
          >
            Colored lines = cumulative production (OK + NG) per part model
          </Box>
          {showIndividualProduces && (
            <Box
              sx={{
                px: 1.2,
                py: 0.3,
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                bgcolor: '#f8fafc',
                fontSize: '0.725rem',
                color: '#475569',
              }}
            >
              Circles = FIRST (PASS) · Crosses = FIRST (FAIL) · Triangles = WIP
            </Box>
          )}
        </Box>

        {/* Bottom Status Information Badges */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          {lastProduceTimestamp && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                px: 1.5,
                py: 0.5,
                borderRadius: '16px',
                border: '1.5px solid #1d4ed8',
                backgroundColor: '#eff6ff',
                color: '#1e40af',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              Last observed produce at: {lastProduceTimestamp}
            </Box>
          )}

          {unknownStats.count > 0 && (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.8,
                px: 1.5,
                py: 0.5,
                borderRadius: '16px',
                border: '1px solid #fed7aa',
                backgroundColor: '#fff7ed',
                color: '#c2410c',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              <WarningIcon sx={{ fontSize: '1rem', color: '#ea580c' }} />
              {unknownStats.count} unknown segments · {unknownStats.minutes} min — click a segment to classify
            </Box>
          )}
        </Box>
      </CardContent>
      </Card>
    </Fade>
  );
};
