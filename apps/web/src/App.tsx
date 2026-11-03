import { useEffect, useRef, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HistoryIcon from '@mui/icons-material/History';
import MenuIcon from '@mui/icons-material/Menu';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import { useFocusOnNavigation } from './hooks/useRouteAccessibility';
import { usePathname, useRoute } from './router';
import type { Route } from './router';
import { AppThemeProvider } from './theme-context';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ActivityPage } from './pages/ActivityPage';
import { EmptyState } from './components/States';
import { ThemeSwitcher } from './components/ThemeSwitcher';

const NAV = [
  { href: '/', label: 'Dashboard', match: ['dashboard'], Icon: DashboardOutlinedIcon },
  {
    href: '/transactions',
    label: 'Transactions',
    match: ['transactions'],
    Icon: ReceiptLongOutlinedIcon,
  },
  {
    href: '/projects',
    label: 'Projects',
    match: ['projects', 'project'],
    Icon: FolderOutlinedIcon,
  },
  { href: '/activity', label: 'Activity', match: ['activity'], Icon: HistoryIcon },
] as const;

const TITLES: Record<Route['name'], string> = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  projects: 'Projects',
  project: 'Project',
  activity: 'Activity',
  notFound: 'Not found',
};

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'dashboard':
      return <DashboardPage />;
    case 'transactions':
      return <TransactionsPage />;
    case 'projects':
      return <ProjectsPage />;
    case 'project':
      return <ProjectDetailPage key={route.id} id={route.id} />;
    case 'activity':
      return <ActivityPage />;
    case 'notFound':
      return (
        <Card>
          <EmptyState
            title="Page not found"
            action={
              <Button variant="contained" href="/">
                Go to the dashboard
              </Button>
            }
          />
        </Card>
      );
  }
}

/** Top bar with inline links on wide screens and a menu drawer on phones. */
function Navigation({ route }: { route: Route }) {
  const [open, setOpen] = useState(false);
  const isActive = (match: readonly string[]) => match.includes(route.name);
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      <Toolbar sx={{ gap: 2 }}>
        <IconButton
          edge="start"
          aria-label="Open navigation"
          onClick={() => setOpen(true)}
          sx={{ display: { md: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Link
          href="/"
          underline="none"
          color="text.primary"
          sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 650 }}
        >
          <AccountBalanceWalletOutlinedIcon color="primary" aria-hidden="true" />
          Expense Tracker
        </Link>
        <Box
          component="nav"
          aria-label="Main"
          sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}
        >
          {NAV.map((item) => {
            const active = isActive(item.match);
            return (
              <Button
                key={item.href}
                href={item.href}
                color={active ? 'primary' : 'inherit'}
                aria-current={active ? 'page' : undefined}
                sx={{
                  fontWeight: active ? 600 : 500,
                  bgcolor: active ? 'action.selected' : undefined,
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Box>
        {/* Right-hand side of the bar: theme switcher and room for the user menu (login, logout). */}
        <Box sx={{ flexGrow: 1 }} />
        <ThemeSwitcher />
      </Toolbar>
      <Drawer open={open} onClose={() => setOpen(false)}>
        <Box component="nav" aria-label="Main" sx={{ width: 260 }}>
          <List>
            {NAV.map((item) => (
              <ListItemButton
                key={item.href}
                href={item.href}
                selected={isActive(item.match)}
                aria-current={isActive(item.match) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <ListItemIcon>
                  <item.Icon />
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
}

export function App() {
  const route = useRoute();
  const mainRef = useRef<HTMLElement>(null);
  useFocusOnNavigation(usePathname(), mainRef);

  useEffect(() => {
    document.title = `${TITLES[route.name]} · Expense Tracker`;
  }, [route.name]);

  return (
    <AppThemeProvider>
      <Link
        href="#main"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: 'tooltip',
          p: 1,
          bgcolor: 'background.paper',
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Link>
      <Navigation route={route} />
      <Container
        component="main"
        ref={mainRef}
        id="main"
        tabIndex={-1}
        maxWidth="lg"
        sx={{ py: 3, outline: 'none' }}
      >
        <Page route={route} />
      </Container>
    </AppThemeProvider>
  );
}
