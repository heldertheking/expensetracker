import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface StatTileProps {
  label: string;
  value: string;
  detail?: ReactNode;
  hero?: boolean;
  /** Direction of the value, shown with an icon and a color that means "good" or "bad". */
  trend?: 'up' | 'down' | 'flat';
}

export function StatTile({ label, value, detail, hero, trend }: StatTileProps) {
  const color = trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.primary';
  const Icon = trend === 'up' ? TrendingUpIcon : trend === 'down' ? TrendingDownIcon : null;
  return (
    <Card component="section" aria-label={label} sx={{ height: '100%' }}>
      <CardContent>
        <Typography component="h2" variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            color,
            fontSize: hero ? '2rem' : '1.5rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            overflowWrap: 'anywhere',
          }}
        >
          {Icon && <Icon fontSize="small" aria-hidden="true" />}
          {value}
        </Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary">
            {detail}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
