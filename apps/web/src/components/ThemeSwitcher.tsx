import { useId, useState } from 'react';
import type { MouseEvent } from 'react';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import ContrastIcon from '@mui/icons-material/Contrast';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import type { ThemePreference } from '../theme';
import { useThemePreference } from '../theme-context';

const OPTIONS: readonly {
  value: ThemePreference;
  label: string;
  Icon: typeof LightModeOutlinedIcon;
}[] = [
  { value: 'system', label: 'System', Icon: SettingsBrightnessOutlinedIcon },
  { value: 'light', label: 'Light', Icon: LightModeOutlinedIcon },
  { value: 'dark', label: 'Dark', Icon: DarkModeOutlinedIcon },
  { value: 'high-contrast', label: 'High contrast', Icon: ContrastIcon },
];

/** Accessible AppBar menu for switching between System, Light, Dark and High contrast themes. */
export function ThemeSwitcher() {
  const { preference, activeTheme, setPreference } = useThemePreference();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const open = Boolean(anchorEl);

  const TriggerIcon =
    activeTheme === 'high-contrast'
      ? ContrastIcon
      : activeTheme === 'dark'
        ? DarkModeOutlinedIcon
        : LightModeOutlinedIcon;

  const handleOpen = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (next: ThemePreference) => {
    setPreference(next);
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title="Theme">
        <IconButton
          color="inherit"
          aria-label="Theme"
          aria-haspopup="menu"
          aria-expanded={open ? 'true' : undefined}
          aria-controls={open ? menuId : undefined}
          onClick={handleOpen}
        >
          <TriggerIcon aria-hidden="true" />
        </IconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{ list: { 'aria-label': 'Theme' } }}
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const selected = preference === value;
          return (
            <MenuItem
              key={value}
              role="menuitemradio"
              aria-checked={selected}
              selected={selected}
              onClick={() => handleSelect(value)}
              sx={{ minWidth: 180, gap: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Icon fontSize="small" aria-hidden="true" />
              </ListItemIcon>
              <ListItemText primary={label} />
              {selected && <CheckIcon fontSize="small" color="primary" aria-hidden="true" />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
