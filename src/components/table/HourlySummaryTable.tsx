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
  Fade,
  LinearProgress,
  Skeleton,
  Box,
} from '@mui/material';
import { HourlySummaryTableProps, RowConfig } from '../../types/table';

export const HourlySummaryTable: React.FC<HourlySummaryTableProps> = ({ columns, metrics, isFetching }) => {
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

  const hasColumns = columns && columns.length > 0;
  const dummyColumns = Array.from({ length: 10 });

  return (
    <Fade in timeout={400}>
      <Card
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          mb: 4,
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 250ms ease-in-out',
        }}
      >
        {isFetching && (
          <LinearProgress
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              zIndex: 10,
              backgroundColor: '#e0f2fe',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#0284c7',
              },
            }}
          />
        )}

        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>
              Hourly Production & Downtime Summary
            </Typography>
            {isFetching && (
              <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600, fontSize: '0.75rem' }}>
                Updating metrics...
              </Typography>
            )}
          </Box>

          <TableContainer
            sx={{
              borderRadius: 1.5,
              border: '1px solid #e2e8f0',
              maxHeight: 540,
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
                      color: '#0f172a',
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
                  {hasColumns
                    ? columns.map((col) => (
                        <TableCell
                          key={col.bucketIndex}
                          align="center"
                          sx={{
                            fontWeight: 700,
                            backgroundColor: '#f8fafc',
                            color: col.isFuture ? '#60a5fa' : '#1a56db',
                            fontSize: '0.8125rem',
                            whiteSpace: 'nowrap',
                            minWidth: 110,
                            transition: 'color 200ms ease',
                          }}
                        >
                          {col.label}
                        </TableCell>
                      ))
                    : dummyColumns.map((_, i) => (
                        <TableCell key={i} align="center" sx={{ minWidth: 110, backgroundColor: '#f8fafc' }}>
                          <Skeleton variant="text" width={70} sx={{ mx: 'auto' }} />
                        </TableCell>
                      ))}
                </TableRow>
              </TableHead>

              <TableBody
                sx={{
                  opacity: isFetching ? 0.55 : 1,
                  filter: isFetching ? 'blur(0.4px)' : 'none',
                  transition: 'opacity 220ms cubic-bezier(0.4, 0, 0.2, 1), filter 220ms ease',
                }}
              >
                {rowConfigs.map((row, rIdx) => (
                  <TableRow
                    key={row.key}
                    sx={{
                      backgroundColor: rIdx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                      '&:hover': { backgroundColor: '#f8fafc' },
                      transition: 'background-color 150ms ease',
                    }}
                  >
                    <TableCell
                      sx={{
                        fontWeight: 500,
                        color: '#475569',
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

                    {hasColumns
                      ? columns.map((col, cIdx) => {
                          const metric = metrics[cIdx];
                          const val = metric ? row.getValue(metric) : '';
                          return (
                            <TableCell
                              key={col.bucketIndex}
                              align="center"
                              sx={{
                                fontSize: '0.8125rem',
                                color: col.isFuture ? '#cbd5e1' : '#0f172a',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                                transition: 'color 150ms ease',
                              }}
                            >
                              {val !== null && val !== undefined ? val : ''}
                            </TableCell>
                          );
                        })
                      : dummyColumns.map((_, cIdx) => (
                          <TableCell key={cIdx} align="center">
                            <Skeleton variant="text" width={40} sx={{ mx: 'auto' }} />
                          </TableCell>
                        ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Fade>
  );
};
