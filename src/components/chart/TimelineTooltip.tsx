import React from 'react';
import { Paper, Typography, Box, Chip } from '@mui/material';

import { HoverTooltipData, TimelineTooltipProps } from '../../types/chart';
export type { HoverTooltipData, TimelineTooltipProps };

export const TimelineTooltip: React.FC<TimelineTooltipProps> = ({ data, containerWidth }) => {
  if (!data) return null;

  // Keep tooltip within horizontal bounds
  const tooltipWidth = 240;
  let left = data.x + 12;
  if (left + tooltipWidth > containerWidth) {
    left = data.x - tooltipWidth - 12;
  }
  const top = Math.max(10, data.y - 70);

  return (
    <Paper
      elevation={4}
      sx={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        pointerEvents: 'none',
        zIndex: 20,
        p: 1.5,
        width: tooltipWidth,
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      }}
    >
      {data.type === 'produce' && data.produce && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>
              Produce Item
            </Typography>
            <Chip
              label={data.produce.result}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: data.produce.result === 'PASS' ? '#dbeafe' : '#ffe4e6',
                color: data.produce.result === 'PASS' ? '#1e40af' : '#be123c',
              }}
            />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
            Time: {data.produce.timestampIst} IST
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.3 }}>
            ID: {data.produce.id.slice(0, 16)}...
          </Typography>
          {data.produce.partModelId && (
            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
              Model: {data.produce.partModelId.slice(0, 12)}...
            </Typography>
          )}
        </Box>
      )}

      {data.type === 'segment' && data.segment && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: data.segment.color,
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a', textTransform: 'capitalize' }}>
              {data.segment.title}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.825rem' }}>
            Duration: {data.segment.durationFormatted}
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.3 }}>
            Window: {data.segment.rangeIst} IST
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
