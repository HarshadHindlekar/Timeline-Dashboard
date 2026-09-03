import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Avatar,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  PrecisionManufacturing as FactoryIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/login');
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        top: 0,
        zIndex: 1100,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid #e2e8f0',
        color: '#1e293b',
      }}
    >
      <Toolbar sx={{ minHeight: 64, px: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 1.5,
              backgroundColor: '#1976d2',
              color: '#ffffff',
            }}
          >
            <FactoryIcon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2, color: '#0f172a' }}>
              Timeline Analytics
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Manufacturing Execution System (MES)
            </Typography>
          </Box>
        </Box>

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {user.customer_name && (
              <Chip
                icon={<BusinessIcon sx={{ fontSize: '1rem !important' }} />}
                label={user.customer_name}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  fontWeight: 500,
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              />
            )}

            {user.roles && user.roles.length > 0 && (
              <Chip
                label={user.roles[0]}
                size="small"
                sx={{
                  backgroundColor: '#e0f2fe',
                  color: '#0284c7',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              />
            )}

            <IconButton
              onClick={handleMenuOpen}
              size="small"
              sx={{
                ml: 0.5,
                border: '1px solid #e2e8f0',
                p: 0.5,
                '&:hover': { bgcolor: '#f1f5f9' },
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: '#2563eb',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              disableScrollLock
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                elevation: 3,
                sx: {
                  minWidth: 220,
                  mt: 1,
                  borderRadius: 2,
                  border: '1px solid #e2e8f0',
                },
              }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                  {user.name || user.username}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                  {user.email || user.username}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleMenuClose} disabled>
                <ListItemIcon>
                  <PersonIcon fontSize="small" />
                </ListItemIcon>
                Profile & Settings
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: '#dc2626' }}>
                <ListItemIcon sx={{ color: '#dc2626' }}>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};
