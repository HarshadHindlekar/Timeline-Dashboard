import React from 'react';
import { Box, Typography } from '@mui/material';

interface LegendItem {
  label: string;
  color: string;
  shape?: 'rect' | 'circle' | 'cross' | 'triangle';
}

interface TimelineLegendProps {
  showIndividualProduces: boolean;
  partModels: string[];
}

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

export const TimelineLegend: React.FC<TimelineLegendProps> = ({
  showIndividualProduces,
  partModels,
}) => {
  const segmentItems: LegendItem[] = [
    { label: 'Runtime', color: SEGMENT_COLORS.runtime, shape: 'rect' },
    { label: 'Unplanned Production', color: SEGMENT_COLORS.unplannedProduction, shape: 'rect' },
    { label: 'Planned Downtime', color: SEGMENT_COLORS.plannedDowntime, shape: 'rect' },
    { label: 'Unplanned Downtime', color: SEGMENT_COLORS.unplannedDowntime, shape: 'rect' },
    { label: 'Minor Stoppage', color: SEGMENT_COLORS.minorStoppage, shape: 'rect' },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        mb: 1.5,
      }}
    >
      {/* Left: Part Models & Produce Marker Symbols */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#334155' }}>
            Part Models:
          </Typography>
          {partModels.length > 0 ? (
            partModels.map((pm, idx) => (
              <Box key={pm || idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#1976d2',
                  }}
                />
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 500 }}>
                  {pm.length > 10 ? `${pm.slice(0, 6)}...` : pm}
                </Typography>
              </Box>
            ))
          ) : (
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              Standard
            </Typography>
          )}
        </Box>

        {showIndividualProduces && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
                OK (PASS)
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="caption"
                sx={{ color: '#e11d48', fontWeight: 800, fontSize: '0.85rem', lineHeight: 1 }}
              >
                ✕
              </Typography>
              <Typography variant="caption" sx={{ color: '#e11d48', fontWeight: 700 }}>
                FAIL
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Right: Segment Bands Legend */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        {segmentItems.map((item) => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '3px',
                backgroundColor: item.color,
              }}
            />
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 500, fontSize: '0.75rem' }}>
              {item.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
