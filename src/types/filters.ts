import { FlattenedAsset } from './asset';
import { ParsedShiftInterval } from './shift';

export interface FilterBarProps {
  assets: FlattenedAsset[];
  selectedLevel: number | 'all';
  selectedAsset: FlattenedAsset | null;
  selectedMachine: FlattenedAsset | null;
  selectedDate: string; // YYYY-MM-DD
  selectedShift: ParsedShiftInterval | null;
  shifts: ParsedShiftInterval[];
  shiftBadgeLabel: string;
  partModelLabel?: string;
  isRefreshing: boolean;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number; // in seconds
  onLevelChange: (level: number | 'all') => void;
  onAssetChange: (asset: FlattenedAsset) => void;
  onMachineChange: (machine: FlattenedAsset | null) => void;
  onDateChange: (date: string) => void;
  onShiftChange: (shift: ParsedShiftInterval) => void;
  onToggleAutoRefresh: (val: boolean) => void;
  onAutoRefreshIntervalChange: (seconds: number) => void;
  onRefresh: () => void;
}
