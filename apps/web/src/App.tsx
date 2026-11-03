import { useEffect } from 'react';
import { Link, useRoute } from './router';
import type { Route } from './router';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ActivityPage } from './pages/ActivityPage';
import { EmptyState } from './components/States';

const NAV = [
  { to: '/', label: 'Dashboard', match: ['dashboard'] },
  { to: '/transactions', label: 'Transactions', match: ['transactions'] },
  { to: '/projects', label: 'Projects', match: ['projects', 'project'] },
  { to: '/activity', label: 'Activity', match: ['activity'] },
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
        <div className="page">
          <EmptyState
            title="Page not found"
            action={
              <Link to="/" className="button primary">
                Go to the dashboard
              </Link>
            }
          />
        </div>
      );
  }
}

export function App() {
  const route = useRoute();

  useEffect(() => {
    document.title = `${TITLES[route.name]} · Expense Tracker`;
  }, [route.name]);

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◆
          </span>
          Expense Tracker
        </Link>
        <nav aria-label="Main">
          <ul className="nav">
            {NAV.map((item) => {
              const active = (item.match as readonly string[]).includes(route.name);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={active ? 'nav-link is-active' : 'nav-link'}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <Page route={route} />
      </main>
    </div>
  );
}
