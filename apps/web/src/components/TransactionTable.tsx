import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import type { Theme } from '@mui/material/styles';
import type { Project, Transaction } from '@expensetracker/schema';
import { formatDate } from '../lib/dates';
import { formatChf } from '../lib/money';
import { ACCOUNT_LABELS } from '../lib/events';
import { visuallyHidden } from '../lib/a11y';
import { RouterLink } from '../router';

interface TransactionTableProps {
  transactions: Transaction[];
  projects: Project[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  caption: string;
}

export function signedAmount(transaction: Transaction): string {
  const sign = transaction.type === 'income' ? '+' : '-';
  return `${sign}${formatChf(transaction.amountCents)}`;
}

/** On phones every row becomes a small card, each cell labelled by its column. */
const stackOnPhones = (theme: Theme) => ({
  [theme.breakpoints.down('sm')]: {
    '& thead': { display: 'none' },
    '& table, & tbody, & tr, & td': { display: 'block', width: '100%' },
    '& tr': { py: 1, borderBottom: `1px solid ${theme.palette.divider}` },
    '& td': {
      border: 'none',
      py: 0.5,
      px: 0,
      display: 'flex',
      flexDirection: 'row', // MUI right-aligned cells use row-reverse
      justifyContent: 'space-between',
      gap: 2,
      textAlign: 'right',
    },
    '& td:not([data-label])': { justifyContent: 'flex-end' },
    '& td[data-label]::before': {
      content: 'attr(data-label)',
      color: theme.palette.text.secondary,
      textAlign: 'left',
    },
  },
});

export function TransactionTable({
  transactions,
  projects,
  onEdit,
  onDelete,
  caption,
}: TransactionTableProps) {
  const projectNames = new Map(projects.map((p) => [p.id, p.name]));
  return (
    <TableContainer sx={stackOnPhones}>
      <Table size="small">
        <caption style={visuallyHidden}>{caption}</caption>
        <TableHead>
          <TableRow>
            <TableCell>Date</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Project</TableCell>
            <TableCell>Account</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell>
              <Box component="span" sx={visuallyHidden}>
                Actions
              </Box>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.map((t) => {
            const projectName = t.projectId ? projectNames.get(t.projectId) : undefined;
            return (
              <TableRow key={t.id} hover>
                <TableCell data-label="Date">{formatDate(t.date)}</TableCell>
                <TableCell data-label="Description">{t.description}</TableCell>
                <TableCell data-label="Project">
                  {t.projectId ? (
                    <Chip
                      size="small"
                      clickable
                      component={RouterLink}
                      href={`/projects/${t.projectId}`}
                      label={projectName ?? 'Unknown project'}
                    />
                  ) : (
                    <Box component="span" sx={{ color: 'text.secondary' }}>
                      –
                    </Box>
                  )}
                </TableCell>
                <TableCell data-label="Account">
                  <Chip size="small" variant="outlined" label={ACCOUNT_LABELS[t.account]} />
                </TableCell>
                <TableCell
                  data-label="Amount"
                  align="right"
                  sx={{
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    color: t.type === 'income' ? 'success.main' : 'text.primary',
                    fontWeight: t.type === 'income' ? 600 : 400,
                  }}
                >
                  <Box component="span" sx={visuallyHidden}>
                    {t.type === 'income' ? 'Income' : 'Expense'}{' '}
                  </Box>
                  {signedAmount(t)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title={`Edit ${t.description}`}>
                    <IconButton size="small" onClick={() => onEdit(t)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={`Delete ${t.description}`}>
                    <IconButton size="small" color="error" onClick={() => onDelete(t)}>
                      <DeleteOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
