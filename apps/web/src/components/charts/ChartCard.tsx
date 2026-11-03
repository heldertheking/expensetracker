import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';

interface ChartCardProps {
  title: string;
  /** One-sentence takeaway; it is also the chart's accessible description. */
  summary: string;
  /** Legend, rendered above the plot. */
  legend?: ReactNode;
  /** The same data as a table: the accessible twin of the chart and the home of every value. */
  table: ReactNode;
  children: ReactNode;
  dimmed?: boolean;
  wide?: boolean;
}

/**
 * A chart in a card. The plot is an image with a name and a summary for screen readers; the
 * "Show table" toggle swaps in the full data as a table.
 */
export function ChartCard({
  title,
  summary,
  legend,
  table,
  children,
  dimmed,
  wide,
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();
  const summaryId = useId();
  return (
    <Card
      component="section"
      aria-labelledby={titleId}
      sx={{
        gridColumn: wide ? '1 / -1' : undefined,
        opacity: dimmed ? 0.55 : 1,
        transition: 'opacity 150ms',
        minWidth: 0,
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography id={titleId} variant="h2">
              {title}
            </Typography>
            <Typography id={summaryId} variant="body2" color="text.secondary">
              {summary}
            </Typography>
          </Box>
          <Button
            size="small"
            aria-pressed={showTable}
            startIcon={showTable ? <BarChartIcon /> : <TableChartOutlinedIcon />}
            onClick={() => setShowTable((value) => !value)}
            sx={{ flexShrink: 0, alignSelf: 'flex-start', whiteSpace: 'nowrap' }}
          >
            {showTable ? 'Show chart' : 'Show table'}
          </Button>
        </Stack>
        {showTable ? (
          table
        ) : (
          <>
            {legend}
            <Box role="img" aria-labelledby={titleId} aria-describedby={summaryId}>
              {children}
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  shape: 'line' | 'rect';
}

/** Legend keys mirror the marks: a short line for lines, a square for bars. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <Stack
      component="ul"
      aria-label="Legend"
      direction="row"
      spacing={2}
      useFlexGap
      sx={{ listStyle: 'none', m: 0, mb: 1, p: 0, flexWrap: 'wrap' }}
    >
      {items.map((item) => (
        <Stack
          component="li"
          key={item.label}
          direction="row"
          spacing={0.75}
          sx={{ alignItems: 'center', typography: 'body2', color: 'text.secondary' }}
        >
          <Box
            aria-hidden="true"
            sx={{
              bgcolor: item.color,
              width: item.shape === 'line' ? 14 : 10,
              height: item.shape === 'line' ? 2 : 10,
              borderRadius: item.shape === 'line' ? 1 : 0.5,
            }}
          />
          <span>{item.label}</span>
        </Stack>
      ))}
    </Stack>
  );
}
