import React from 'react';
import { Box, Typography } from '@mui/material';

interface StatusPillProps {
  label: string;
  variant?: 'primary' | 'neutral';
}

export const StatusPill: React.FC<StatusPillProps> = ({ label, variant = 'primary' }) => {
  const isPrimary = variant === 'primary';

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.5,
        py: 0.4,
        borderRadius: '16px',
        backgroundColor: isPrimary ? '#e8f0fe' : '#f1f5f9',
        border: `1px solid ${isPrimary ? '#bed8fb' : '#cbd5e1'}`,
        color: isPrimary ? '#1a56db' : '#334155',
        fontSize: '0.8125rem',
        fontWeight: 500,
        lineHeight: 1.4,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'inherit' }}>
        {label}
      </Typography>
    </Box>
  );
};
