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
  Switch,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { StatusPill } from '../common/StatusPill';
import { FilterBarProps } from '../../types/filters';

export const FilterBar: React.FC<FilterBarProps> = ({
  assets,
  selectedLevel,
  selectedAsset,
  selectedMachine,
  selectedDate,
  selectedShift,
  shifts,
  shiftBadgeLabel,
  partModelLabel,
  isRefreshing,
  autoRefreshEnabled,
  autoRefreshInterval,
  onLevelChange,
  onAssetChange,
  onMachineChange,
  onDateChange,
  onShiftChange,
  onToggleAutoRefresh,
  onAutoRefreshIntervalChange,
  onRefresh,
}) => {
  // Available asset levels
  const levelOptions = [
    { value: 'all', label: 'All Levels' },
    { value: 40, label: 'Plant' },
    { value: 30, label: 'Shop' },
    { value: 20, label: 'Line' },
    { value: 10, label: 'Machine' },
  ];

  // Filter assets matching selected level (if not 'all')
  const filteredAssets = React.useMemo(() => {
    if (selectedLevel === 'all') {
      // Prioritize lines and parent nodes
      return assets.filter((a) => a.assetlevel_id >= 20);
    }
    return assets.filter((a) => a.assetlevel_id === selectedLevel);
  }, [assets, selectedLevel]);

  // Available machines under selected asset (children with level 10)
  const availableMachines = React.useMemo(() => {
    if (!selectedAsset) return [];
    return assets.filter(
      (a) => a.assetlevel_id === 10 && (a.parentId === selectedAsset.id || a.path.includes(selectedAsset.name))
    );
  }, [assets, selectedAsset]);

  // Effective display name for pill
  const activePillName = selectedMachine ? selectedMachine.name : selectedAsset ? selectedAsset.name : 'All';

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
            gap: 1.5,
          }}
        >
          {/* 1. ASSET LEVEL */}
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel id="asset-level-label" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              ASSET LEVEL
            </InputLabel>
            <Select
              labelId="asset-level-label"
              value={selectedLevel}
              label="ASSET LEVEL"
              onChange={(e) => onLevelChange(e.target.value as number | 'all')}
              sx={{ fontSize: '0.85rem' }}
              MenuProps={{ disableScrollLock: true }}
            >
              {levelOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.85rem' }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 2. ASSET */}
          <FormControl size="small" sx={{ minWidth: 180, flex: { xs: '1 1 100%', sm: '0 1 200px' } }}>
            <InputLabel id="asset-label" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              ASSET
            </InputLabel>
            <Select
              labelId="asset-label"
              value={selectedAsset?.id || ''}
              label="ASSET"
              onChange={(e) => {
                const found = assets.find((a) => a.id === e.target.value);
                if (found) onAssetChange(found);
              }}
              sx={{ fontSize: '0.85rem' }}
              MenuProps={{ disableScrollLock: true }}
            >
              {filteredAssets.map((asset) => (
                <MenuItem key={asset.id} value={asset.id} sx={{ fontSize: '0.85rem' }}>
                  {asset.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 3. MACHINE (OPTIONAL) */}
          <FormControl size="small" sx={{ minWidth: 160, flex: { xs: '1 1 45%', sm: '0 1 180px' } }}>
            <InputLabel id="machine-optional-label" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              MACHINE (OPTIONAL)
            </InputLabel>
            <Select
              labelId="machine-optional-label"
              value={selectedMachine?.id || 'none'}
              label="MACHINE (OPTIONAL)"
              onChange={(e) => {
                if (e.target.value === 'none') {
                  onMachineChange(null);
                } else {
                  const found = availableMachines.find((m) => m.id === e.target.value);
                  if (found) onMachineChange(found);
                }
              }}
              sx={{ fontSize: '0.85rem' }}
              MenuProps={{ disableScrollLock: true }}
            >
              <MenuItem value="none" sx={{ fontSize: '0.85rem' }}>
                —
              </MenuItem>
              {availableMachines.map((m) => (
                <MenuItem key={m.id} value={m.id} sx={{ fontSize: '0.85rem' }}>
                  {m.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 4. DATE */}
          <TextField
            size="small"
            type="date"
            label="DATE"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            InputLabelProps={{ shrink: true, sx: { fontSize: '0.75rem', fontWeight: 600 } }}
            sx={{
              minWidth: 140,
              '& .MuiInputBase-input': { fontSize: '0.85rem' },
            }}
          />

          {/* 5. SHIFT */}
          <FormControl size="small" sx={{ minWidth: 190, flex: { xs: '1 1 45%', sm: '0 1 200px' } }}>
            <InputLabel id="shift-label" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
              SHIFT
            </InputLabel>
            <Select
              labelId="shift-label"
              value={selectedShift?.id || ''}
              label="SHIFT"
              onChange={(e) => {
                const found = shifts.find((s) => s.id === e.target.value);
                if (found) onShiftChange(found);
              }}
              sx={{ fontSize: '0.85rem' }}
              MenuProps={{ disableScrollLock: true }}
            >
              {shifts.map((shift) => (
                <MenuItem key={shift.id} value={shift.id} sx={{ fontSize: '0.85rem' }}>
                  {shift.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* 6. Far Right: Auto Refresh + Interval + Manual Refresh */}
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#475569', fontWeight: 500, fontSize: '0.75rem' }}>
                Auto Refresh
              </Typography>
              <Switch
                checked={autoRefreshEnabled}
                onChange={(e) => onToggleAutoRefresh(e.target.checked)}
                size="small"
              />
            </Box>

            <FormControl size="small" sx={{ minWidth: 85 }}>
              <Select
                value={autoRefreshInterval}
                onChange={(e) => onAutoRefreshIntervalChange(Number(e.target.value))}
                sx={{ fontSize: '0.8rem', height: 32 }}
                disabled={!autoRefreshEnabled}
                MenuProps={{ disableScrollLock: true }}
              >
                <MenuItem value={15} sx={{ fontSize: '0.75rem' }}>15 sec</MenuItem>
                <MenuItem value={30} sx={{ fontSize: '0.75rem' }}>30 sec</MenuItem>
                <MenuItem value={60} sx={{ fontSize: '0.75rem' }}>1 min</MenuItem>
                <MenuItem value={300} sx={{ fontSize: '0.75rem' }}>5 min</MenuItem>
              </Select>
            </FormControl>

            <Tooltip title="Refresh Dashboard Data">
              <span>
                <IconButton
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  size="small"
                  sx={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 1.5,
                    p: 0.8,
                    '&:hover': { bgcolor: '#f1f5f9' },
                  }}
                >
                  {isRefreshing ? (
                    <CircularProgress size={16} thickness={5} />
                  ) : (
                    <RefreshIcon fontSize="small" sx={{ color: '#475569' }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        {/* Selected Filter Summary Pills */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2, alignItems: 'center' }}>
          <StatusPill label={activePillName} />
          <StatusPill label={shiftBadgeLabel} variant="neutral" />
          {partModelLabel && <StatusPill label={`Part model: ${partModelLabel}`} variant="neutral" />}
        </Box>
      </CardContent>
    </Card>
  );
};
