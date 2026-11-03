import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import type { BusinessEvent } from '@expensetracker/schema';
import { describeEvent, EVENT_TYPE_LABELS } from '../lib/events';
import { formatDateTime } from '../lib/dates';
import { visuallyHidden } from '../lib/a11y';

const TONES = {
  create: { Icon: AddIcon, color: 'success.main' },
  update: { Icon: EditOutlinedIcon, color: 'text.secondary' },
  delete: { Icon: DeleteOutlinedIcon, color: 'error.main' },
} as const;

export function ActivityList({ events }: { events: BusinessEvent[] }) {
  return (
    <List disablePadding>
      {events.map((event, index) => {
        const { title, detail, tone } = describeEvent(event);
        const { Icon, color } = TONES[tone];
        return (
          <ListItem
            key={event.id}
            divider={index < events.length - 1}
            disableGutters
            sx={{ alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
          >
            <ListItemAvatar sx={{ minWidth: 48 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'action.hover', color }}>
                <Icon fontSize="small" aria-hidden="true" />
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={title}
              secondary={detail || undefined}
              sx={{
                my: 0,
                overflowWrap: 'anywhere',
                flex: { xs: '1 1 calc(100% - 48px)', sm: '1 1 auto' },
              }}
              slotProps={{ primary: { sx: { fontWeight: 500 } } }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ whiteSpace: 'nowrap', pl: { xs: 6, sm: 2 }, width: { xs: '100%', sm: 'auto' } }}
            >
              <Box component="span" sx={visuallyHidden}>
                {EVENT_TYPE_LABELS[event.type]},{' '}
              </Box>
              <time dateTime={event.occurredAt.toISOString()}>
                {formatDateTime(event.occurredAt)}
              </time>
            </Typography>
          </ListItem>
        );
      })}
    </List>
  );
}
