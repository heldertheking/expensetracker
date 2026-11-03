import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { errorMessage } from '../api/client';

/** Skeleton placeholder; screen readers hear the label instead of the shapes. */
export function Loading({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <Box role="status" aria-label={label} aria-live="polite" sx={{ py: 1 }}>
      <Stack spacing={1.5} aria-hidden="true">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} variant="rounded" height={i === 0 ? 32 : 20} />
        ))}
      </Stack>
    </Box>
  );
}

export function ErrorState({
  error,
  title = 'Could not load data',
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {errorMessage(error)}
    </Alert>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 4, px: 2 }}>
      <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
      {children && (
        <Typography variant="body2" color="text.secondary">
          {children}
        </Typography>
      )}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}
