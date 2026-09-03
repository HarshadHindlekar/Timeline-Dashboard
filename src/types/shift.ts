export interface RawShift {
  id: string;
  code: string;
  name: string;
  shift_timings: string[];
  is_active: boolean;
}

export interface ParsedShiftInterval {
  id: string;
  shiftDefinitionId: string;
  name: string;
  code: string;
  startTime: string; // "HH:MM"
  endTime: string;   // "HH:MM"
  crossesMidnight: boolean;
}
