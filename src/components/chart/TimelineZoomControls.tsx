import React from 'react';
import { Box, IconButton, Tooltip, ButtonGroup, Button, Chip } from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import { TimelineZoomControlsProps } from '../../types/chart';

export const TimelineZoomControls: React.FC<TimelineZoomControlsProps> = ({
  showIndividualProduces,
  isZoomed,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onZoomPreset,
}) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        zIndex: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(6px)',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
        p: 0.5,
      }}
    >
      {/* Quick Time Presets (especially useful when Show Individual Produces is ON) */}
      {showIndividualProduces && (
        <Box sx={{ display: 'flex', gap: 0.5, mr: 0.5 }}>
          <Chip
            label="1h"
            size="small"
            onClick={() => onZoomPreset(1)}
            variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
          />
          <Chip
            label="2h"
            size="small"
            onClick={() => onZoomPreset(2)}
            variant="outlined"
            sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
          />
          <Chip
            label="Full"
            size="small"
            onClick={onResetZoom}
            variant={!isZoomed ? 'filled' : 'outlined'}
            color={!isZoomed ? 'primary' : 'default'}
            sx={{ height: 24, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
          />
        </Box>
      )}

      <ButtonGroup size="small" variant="outlined" sx={{ height: 26 }}>
        <Tooltip title="Zoom In (or scroll wheel up)">
          <IconButton size="small" onClick={onZoomIn} sx={{ p: 0.4, borderRadius: 0 }}>
            <ZoomInIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom Out (or scroll wheel down)">
          <IconButton size="small" onClick={onZoomOut} sx={{ p: 0.4, borderRadius: 0 }}>
            <ZoomOutIcon sx={{ fontSize: '1.1rem' }} />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      {isZoomed && (
        <Tooltip title="Reset to full shift window">
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={onResetZoom}
            startIcon={<ResetIcon sx={{ fontSize: '0.95rem !important' }} />}
            sx={{
              height: 26,
              fontSize: '0.72rem',
              textTransform: 'none',
              fontWeight: 600,
              px: 1,
            }}
          >
            Reset
          </Button>
        </Tooltip>
      )}
    </Box>
  );
};
