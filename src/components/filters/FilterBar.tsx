import React from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { AssetNode, FlattenedAsset } from '../../types/asset';
import { ParsedShiftInterval } from '../../types/shift';
import { StatusPill } from '../common/StatusPill';

interface FilterBarProps {
  assets: FlattenedAsset[];
  assetTree: AssetNode[];
  shifts: ParsedShiftInterval[];
  selectedAsset: FlattenedAsset | null;
  selectedDate: string; // YYYY-MM-DD
  selectedShift: ParsedShiftInterval | null;
  shiftBadgeLabel: string;
  partModelLabel?: string;
  isRefreshing: boolean;
  onAssetChange: (asset: FlattenedAsset) => void;
  onDateChange: (date: string) => void;
  onShiftChange: (shift: ParsedShiftInterval) => void;
  onRefresh: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  assets,
  shifts,
  selectedAsset,
  selectedDate,
  selectedShift,
  shiftBadgeLabel,
  partModelLabel,
  isRefreshing,
  onAssetChange,
  onDateChange,
  onShiftChange,
  onRefresh,
}) => {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        mb: 2.5,
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Controls Row */}
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2,
          }}
        >
          {/* Asset / Machine Selector */}
          <FormControl size="small" sx={{ minWidth: 240, flex: { xs: '1 1 100%', sm: '1 1 240px', md: '0 1 280px' } }}>
            <InputLabel id="asset-select-label" sx={{ fontSize: '0.85rem' }}>
              ASSET / MACHINE
            </InputLabel>
            <Select
              labelId="asset-select-label"
              value={selectedAsset?.id || ''}
              label="ASSET / MACHINE"
              onChange={(e) => {
                const found = assets.find((a) => a.id === e.target.value);
                if (found) onAssetChange(found);
              }}
              sx={{ fontSize: '0.875rem' }}
            >
              {assets.map((asset) => (
                <MenuItem key={asset.id} value={asset.id}>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {asset.name} {asset.codename ? `(${asset.codename})` : ''}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                      {asset.path}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Date Picker */}
          <TextField
            size="small"
            type="date"
            label="DATE"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{
              minWidth: 160,
              flex: { xs: '1 1 45%', sm: '0 1 170px' },
              '& .MuiInputBase-input': { fontSize: '0.875rem' },
            }}
          />

          {/* Shift Selector */}
          <FormControl size="small" sx={{ minWidth: 210, flex: { xs: '1 1 45%', sm: '0 1 220px' } }}>
            <InputLabel id="shift-select-label" sx={{ fontSize: '0.85rem' }}>
              SHIFT
            </InputLabel>
            <Select
              labelId="shift-select-label"
              value={selectedShift?.id || ''}
              label="SHIFT"
              onChange={(e) => {
                const found = shifts.find((s) => s.id === e.target.value);
                if (found) onShiftChange(found);
              }}
              sx={{ fontSize: '0.875rem' }}
            >
              {shifts.map((shift) => (
                <MenuItem key={shift.id} value={shift.id} sx={{ fontSize: '0.875rem' }}>
                  {shift.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Refresh Action */}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
            <Tooltip title="Refresh Dashboard Data">
              <span>
                <IconButton
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  size="small"
                  sx={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 1.5,
                    p: 1,
                    '&:hover': { bgcolor: '#f1f5f9' },
                  }}
                >
                  {isRefreshing ? (
                    <CircularProgress size={18} thickness={5} />
                  ) : (
                    <RefreshIcon fontSize="small" sx={{ color: '#475569' }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Selected Filter Summary Pills Row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, alignItems: 'center' }}>
          {selectedAsset && <StatusPill label={selectedAsset.name} />}
          <StatusPill label={shiftBadgeLabel} />
          {partModelLabel && <StatusPill label={`Part model: ${partModelLabel}`} variant="neutral" />}
        </Box>
      </CardContent>
    </Card>
  );
};
