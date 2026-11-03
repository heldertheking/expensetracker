import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { visuallyHidden } from '../../lib/a11y';

interface DataTableProps {
  caption: string;
  /** First column header (the row labels), then one header per value column. */
  columns: string[];
  rows: { key: string; label: string; values: string[] }[];
}

/** The table view of a chart: row headers on the left, numbers right-aligned. */
export function DataTable({ caption, columns, rows }: DataTableProps) {
  const [first, ...rest] = columns;
  return (
    <TableContainer>
      <Table size="small">
        <Box component="caption" sx={visuallyHidden}>
          {caption}
        </Box>
        <TableHead>
          <TableRow>
            <TableCell>{first}</TableCell>
            {rest.map((column) => (
              <TableCell key={column} align="right">
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell component="th" scope="row">
                {row.label}
              </TableCell>
              {row.values.map((value, i) => (
                <TableCell
                  key={rest[i]}
                  align="right"
                  sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}
                >
                  {value}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
