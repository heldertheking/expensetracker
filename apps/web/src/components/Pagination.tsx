import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  label?: string;
}

export function Pagination({
  total,
  limit,
  offset,
  onChange,
  label = 'Pagination',
}: PaginationProps) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  const first = offset + 1;
  const last = Math.min(offset + limit, total);
  return (
    <Stack
      component="nav"
      aria-label={label}
      direction="row"
      spacing={2}
      sx={{ justifyContent: 'space-between', alignItems: 'center', pt: 2, flexWrap: 'wrap' }}
    >
      <Button
        variant="outlined"
        startIcon={<ChevronLeftIcon />}
        disabled={page <= 1}
        onClick={() => onChange(Math.max(0, offset - limit))}
      >
        Previous
      </Button>
      <Typography variant="body2" color="text.secondary" aria-live="polite">
        {first}–{last} of {total} · page {page} of {pages}
      </Typography>
      <Button
        variant="outlined"
        endIcon={<ChevronRightIcon />}
        disabled={page >= pages}
        onClick={() => onChange(offset + limit)}
      >
        Next
      </Button>
    </Stack>
  );
}
