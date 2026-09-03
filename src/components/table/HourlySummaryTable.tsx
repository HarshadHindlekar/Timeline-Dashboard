import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import { HourlySummaryColumn } from '../../types/analytics';
import { HourMetrics } from '../../utils/segmentSlicer';

interface HourlySummaryTableProps {
  columns: HourlySummaryColumn[];
  metrics: HourMetrics[];
}

interface RowConfig {
  key: string;
  label: string;
  getValue: (m: HourMetrics) => string | number | null;
  bold?: boolean;
}

export const HourlySummaryTable: React.FC<HourlySummaryTableProps> = ({ columns, metrics }) => {
  const rowConfigs: RowConfig[] = [
    {
      key: 'total',
      label: 'Total',
      getValue: (m) => (m.isFuture ? '' : m.totalProduces ?? 0),
      bold: true,
    },
    {
      key: 'pass',
      label: 'Pass',
      getValue: (m) => (m.isFuture ? '' : m.passProduces ?? 0),
    },
    {
      key: 'fail',
      label: 'Fail',
      getValue: (m) => (m.isFuture ? '' : m.failProduces ?? 0),
    },
    {
      key: 'actual_cycle_time',
      label: 'Actual Cycle Time',
      getValue: (m) => (m.isFuture ? '' : m.actualCycleTime || '-'),
    },
    {
      key: 'ideal_cycle_time',
      label: 'Ideal Cycle Time',
      getValue: (m) => (m.isFuture ? '' : m.idealCycleTime || '-'),
    },
    {
      key: 'runtime',
      label: 'Runtime',
      getValue: (m) => (m.isFuture ? '' : `${m.runtimeMins ?? 0} mins`),
    },
    {
      key: 'planned_downtime',
      label: 'Planned Downtime',
      getValue: (m) => (m.isFuture ? '' : `${m.plannedDowntimeMins ?? 0} mins`),
    },
    {
      key: 'minor_stoppage',
      label: 'Minor Stoppage',
      getValue: (m) => (m.isFuture ? '' : `${m.minorStoppageMins ?? 0} mins`),
    },
    {
      key: 'unknown_downtime',
      label: 'Unknown Downtime',
      getValue: (m) => (m.isFuture ? '' : `${m.unknownDowntimeMins ?? 0} mins`),
    },
    {
      key: 'unplanned_downtime',
      label: 'Unplanned Downtime',
      getValue: (m) => (m.isFuture ? '' : `${m.unplannedDowntimeMins ?? 0} mins`),
    },
    {
      key: 'unplanned_production',
      label: 'Unplanned Production',
      getValue: (m) => (m.isFuture ? '' : `${m.unplannedProductionMins ?? 0} mins`),
    },
    {
      key: 'unknown_unplanned_production',
      label: 'Unknown Unplanned Production',
      getValue: (m) => (m.isFuture ? '' : `${m.unknownUnplannedProductionMins ?? 0} mins`),
    },
  ];

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        border: '1px solid #e2e8f0',
        backgroundColor: '#ffffff',
        mb: 4,
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', mb: 2 }}>
          Hourly Production & Downtime Summary
        </Typography>

        <TableContainer
          sx={{
            borderRadius: 1.5,
            border: '1px solid #e2e8f0',
            maxHeight: 520,
            overflowX: 'auto',
          }}
        >
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 700,
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontSize: '0.8125rem',
                    borderRight: '1px solid #e2e8f0',
                    minWidth: 190,
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                  }}
                >
                  Param
                </TableCell>
                {columns.map((col) => (
                  <TableCell
                    key={col.bucketIndex}
                    align="center"
                    sx={{
                      fontWeight: 700,
                      backgroundColor: '#f8fafc',
                      color: col.isFuture ? '#94a3b8' : '#1e293b',
                      fontSize: '0.8125rem',
                      whiteSpace: 'nowrap',
                      minWidth: 110,
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rowConfigs.map((row, rIdx) => (
                <TableRow
                  key={row.key}
                  sx={{
                    backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                    '&:hover': { backgroundColor: '#f8fafc' },
                  }}
                >
                  <TableCell
                    sx={{
                      fontWeight: row.bold ? 700 : 500,
                      color: row.bold ? '#0f172a' : '#475569',
                      fontSize: '0.8125rem',
                      borderRight: '1px solid #e2e8f0',
                      backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                    }}
                  >
                    {row.label}
                  </TableCell>
                  {columns.map((col, cIdx) => {
                    const metric = metrics[cIdx];
                    const val = metric ? row.getValue(metric) : '';
                    return (
                      <TableCell
                        key={col.bucketIndex}
                        align="center"
                        sx={{
                          fontSize: '0.8125rem',
                          color: col.isFuture ? '#cbd5e1' : '#1e293b',
                          fontWeight: row.bold ? 700 : 400,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {val !== null && val !== undefined ? val : ''}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};
