import { useId } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export function Page({ children }: { children: ReactNode }) {
  return <Stack spacing={2.5}>{children}</Stack>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-end' } }}
    >
      <Box>
        <Typography variant="h1">{title}</Typography>
        {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
      </Box>
      {actions}
    </Stack>
  );
}

/** A card with a heading (its accessible name) and an optional link on the right. */
export function SectionCard({
  title,
  subtitle,
  link,
  children,
  dimmed,
}: {
  title: string;
  subtitle?: string;
  link?: { href: string; label: string };
  children: ReactNode;
  dimmed?: boolean;
}) {
  const titleId = useId();
  return (
    <Card
      component="section"
      aria-labelledby={titleId}
      sx={{ opacity: dimmed ? 0.55 : 1, transition: 'opacity 150ms', minWidth: 0 }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography id={titleId} variant="h2">
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {link && (
            <Link href={link.href} variant="body2" underline="hover">
              {link.label}
            </Link>
          )}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

/** A responsive grid: one column on phones, `columns` from the `md` breakpoint. */
export function ResponsiveGrid({
  columns = 2,
  children,
}: {
  columns?: number;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          sm: columns > 2 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
          md: `repeat(${columns}, minmax(0, 1fr))`,
        },
      }}
    >
      {children}
    </Box>
  );
}
