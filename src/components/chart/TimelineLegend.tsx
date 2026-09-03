import React from 'react';
import { Box, Typography } from '@mui/material';

export const SEGMENT_COLORS = {
  runtime: '#00a389',
  unplannedProduction: '#a5d610',
  plannedDowntime: '#6bb024',
  unplannedDowntime: '#f06a4b',
  unknownDowntime: '#f06a4b',
  minorStoppage: '#5e50a1',
  pass: '#1976d2',
  fail: '#e11d48',
};

export const TimelineLegend: React.FC = () => {
  const segmentItems = [
    { label: 'Runtime', color: SEGMENT_COLORS.runtime },
    { label: 'Unplanned Production', color: SEGMENT_COLORS.unplannedProduction },
    { label: 'Planned Downtime', color: SEGMENT_COLORS.plannedDowntime },
    { label: 'Unplanned Downtime', color: SEGMENT_COLORS.unplannedDowntime },
    { label: 'Minor Stoppage', color: SEGMENT_COLORS.minorStoppage },
  ];

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.8 }}>
      {segmentItems.map((item) => (
        <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
          <Box
            sx={{
              width: 13,
              height: 13,
              borderRadius: '2px',
              backgroundColor: item.color,
            }}
          />
          <Typography variant="caption" sx={{ color: '#334155', fontWeight: 500, fontSize: '0.75rem' }}>
            {item.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};
