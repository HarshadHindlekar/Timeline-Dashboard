import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Fade,
} from '@mui/material';

export const DashboardSkeleton: React.FC = () => {
  return (
    <Fade in timeout={300}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Timeline Section Skeleton */}
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            {/* Header: Title & Legend Chips */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Skeleton variant="text" width={160} height={28} sx={{ borderRadius: 1 }} />
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Skeleton variant="rounded" width={70} height={16} sx={{ borderRadius: 0.5 }} />
                <Skeleton variant="rounded" width={120} height={16} sx={{ borderRadius: 0.5 }} />
                <Skeleton variant="rounded" width={100} height={16} sx={{ borderRadius: 0.5 }} />
                <Skeleton variant="rounded" width={110} height={16} sx={{ borderRadius: 0.5 }} />
              </Box>
            </Box>

            {/* Sub-row: Part model & Toggles */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Skeleton variant="text" width={90} height={20} />
                <Skeleton variant="circular" width={14} height={14} />
                <Skeleton variant="text" width={60} height={20} />
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Skeleton variant="rounded" width={100} height={24} sx={{ borderRadius: 2 }} />
                <Skeleton variant="rounded" width={150} height={24} sx={{ borderRadius: 2 }} />
              </Box>
            </Box>

            {/* Canvas Area Skeleton */}
            <Skeleton
              variant="rounded"
              height={280}
              sx={{
                borderRadius: 1.5,
                bgcolor: '#f1f5f9',
                mb: 2,
              }}
            />

            {/* Instruction Pills Skeleton */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Skeleton variant="rounded" width={260} height={22} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rounded" width={240} height={22} sx={{ borderRadius: 2 }} />
            </Box>

            {/* Status Pills Skeleton */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Skeleton variant="rounded" width={220} height={28} sx={{ borderRadius: 3 }} />
              <Skeleton variant="rounded" width={260} height={28} sx={{ borderRadius: 3 }} />
            </Box>
          </CardContent>
        </Card>

        {/* Hourly Table Skeleton */}
        <Card
          elevation={0}
          sx={{
            borderRadius: 2,
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            mb: 4,
          }}
        >
          <CardContent sx={{ p: 2.5 }}>
            <Skeleton variant="text" width={260} height={30} sx={{ mb: 2, borderRadius: 1 }} />

            <TableContainer
              sx={{
                borderRadius: 1.5,
                border: '1px solid #e2e8f0',
                overflowX: 'hidden',
              }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell sx={{ width: 200, borderRight: '1px solid #e2e8f0' }}>
                      <Skeleton variant="text" width={60} height={20} />
                    </TableCell>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <TableCell key={i} align="center">
                        <Skeleton variant="text" width={75} height={20} sx={{ mx: 'auto' }} />
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Array.from({ length: 9 }).map((_, rIdx) => (
                    <TableRow key={rIdx}>
                      <TableCell sx={{ borderRight: '1px solid #e2e8f0' }}>
                        <Skeleton variant="text" width={110} height={18} />
                      </TableCell>
                      {Array.from({ length: 8 }).map((_, cIdx) => (
                        <TableCell key={cIdx} align="center">
                          <Skeleton variant="text" width={45} height={18} sx={{ mx: 'auto' }} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Box>
    </Fade>
  );
};
