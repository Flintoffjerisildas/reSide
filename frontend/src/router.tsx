import React, { useEffect } from 'react';
import {
  createRouter,
  createRoute,
  createRootRoute,
  Outlet,
  useNavigate,
  useParams,
  useSearch,
  useLocation,
} from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './contexts/AuthContext';
import { useGetCallerUserProfile, useIsCallerApproved } from './hooks/useQueries';
import { TamilRole } from './types';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import FloatingChat from './components/FloatingChat';
import AuroraBackground from './components/AuroraBackground';
import PropertyListings from './components/PropertyListings';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import PendingApprovalScreen from './components/PendingApprovalScreen';
import LoginPage, { LoginView } from './components/LoginPage';
import LoadingScreen from './components/LoadingScreen';
import NotFoundPage from './components/NotFoundPage';

// --- Root Layout ---
function RootLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, isInitializing: authInitializing, logout } = useAuth();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();

  const isAuthenticated = !!user;
  const roleToCheck = userProfile?.role || user?.role;
  const internalRoleToCheck = (userProfile as any)?.internalRole || (user as any)?.internalRole;
  const isAdmin = internalRoleToCheck === 'admin' || roleToCheck === 'admin' || roleToCheck === TamilRole.admin;

  const handleLogout = () => {
    logout();
    queryClient.clear();
    navigate({ to: '/' });
  };

  const handleHomeClick = () => {
    navigate({ to: '/' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBrowseProperties = (type: 'rent' | 'buy') => {
    navigate({ to: type === 'rent' ? '/rent' : '/buy' });
    requestAnimationFrame(() => {
      document.getElementById('property-listings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const isDashboardActive = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin');

  const handleDashboardClick = () => {
    if (isDashboardActive) {
      navigate({ to: '/' });
    } else {
      if (isAdmin) {
        navigate({ to: '/admin' });
      } else {
        navigate({ to: '/dashboard' });
      }
    }
  };

  if (authInitializing || (isAuthenticated && profileLoading)) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <AuroraBackground />
      <Header
        onLogout={handleLogout}
        onDashboardClick={handleDashboardClick}
        onHomeClick={handleHomeClick}
        onAboutClick={() => navigate({ to: '/about' })}
        onRentClick={() => handleBrowseProperties('rent')}
        onBuyClick={() => handleBrowseProperties('buy')}
        onLoginClick={() => navigate({ to: '/login', search: {} })}
        onNotificationsClick={() => navigate({ to: '/dashboard/$tab', params: { tab: 'notifications' } })}
        isDashboardActive={isDashboardActive}
      />
      <main className="flex-1 w-full">
        <Outlet />
        <FloatingChat />
      </main>
      <Footer />
    </div>
  );
}

// --- Page Wrappers ---

function PropertyListingsWrapper({ initialType = '', showAbout = false }: { initialType?: 'rent' | 'buy' | ''; showAbout?: boolean }) {
  const navigate = useNavigate();

  return (
    <PropertyListings
      showAbout={showAbout}
      initialTransactionType={initialType}
      onSelectProperty={(id) => {
        if (id) {
          navigate({ to: '/property/$propertyId', params: { propertyId: id } });
        } else {
          navigate({ to: '/' });
        }
      }}
      onTransactionTypeChange={(type) => {
        if (type === 'rent') {
          navigate({ to: '/rent' });
        } else if (type === 'buy') {
          navigate({ to: '/buy' });
        } else {
          navigate({ to: '/' });
        }
      }}
    />
  );
}

function PropertyDetailWrapper() {
  const { propertyId } = useParams({ from: '/property/$propertyId' });
  const navigate = useNavigate();

  return (
    <PropertyListings
      selectedPropertyId={propertyId}
      onSelectProperty={(id) => {
        if (!id) {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            navigate({ to: '/' });
          }
        } else if (id !== propertyId) {
          navigate({ to: '/property/$propertyId', params: { propertyId: id } });
        }
      }}
      onTransactionTypeChange={(type) => {
        if (type === 'rent') {
          navigate({ to: '/rent' });
        } else if (type === 'buy') {
          navigate({ to: '/buy' });
        } else {
          navigate({ to: '/' });
        }
      }}
    />
  );
}

function LoginPageWrapper({ defaultView }: { defaultView: LoginView }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: userProfile } = useGetCallerUserProfile();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirectTarget = search?.redirect;

  const roleToCheck = userProfile?.role || user?.role;
  const internalRoleToCheck = (userProfile as any)?.internalRole || (user as any)?.internalRole;
  const isAdmin = internalRoleToCheck === 'admin' || roleToCheck === 'admin' || roleToCheck === TamilRole.admin;

  useEffect(() => {
    if (user) {
      if (redirectTarget && redirectTarget.startsWith('/') && !redirectTarget.startsWith('//')) {
        navigate({ to: redirectTarget as any });
      } else if (isAdmin) {
        navigate({ to: '/admin' });
      } else {
        navigate({ to: '/dashboard' });
      }
    }
  }, [user, redirectTarget, isAdmin, navigate]);

  return (
    <LoginPage
      defaultView={defaultView}
      onSuccess={() => {
        if (redirectTarget && redirectTarget.startsWith('/') && !redirectTarget.startsWith('//')) {
          navigate({ to: redirectTarget as any });
        } else if (isAdmin) {
          navigate({ to: '/admin' });
        } else {
          navigate({ to: '/dashboard' });
        }
      }}
      onNavigateView={(v) => {
        if (v === 'register') {
          navigate({ to: '/register', search: { redirect: redirectTarget || undefined } });
        } else if (v === 'login') {
          navigate({ to: '/login', search: { redirect: redirectTarget || undefined } });
        } else if (v === 'forgot-email' || v === 'forgot-otp') {
          navigate({ to: '/forgot-password' });
        }
      }}
    />
  );
}

// --- Protected Dashboard Guard & Layout ---
function DashboardLayoutWrapper() {
  const { user, isInitializing } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const { data: isApproved, isLoading: approvalLoading } = useIsCallerApproved();

  const roleToCheck = userProfile?.role || user?.role;
  const internalRoleToCheck = (userProfile as any)?.internalRole || (user as any)?.internalRole;
  const isAdmin = internalRoleToCheck === 'admin' || roleToCheck === 'admin' || roleToCheck === TamilRole.admin;

  useEffect(() => {
    if (!isInitializing && !user) {
      navigate({
        to: '/login',
        search: { redirect: location.pathname + location.search },
      });
    }
  }, [user, isInitializing, location.pathname, location.search, navigate]);

  if (isInitializing || (user && profileLoading)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return null;
  }

  if (isAdmin && !approvalLoading && isApproved === false) {
    return <PendingApprovalScreen />;
  }

  if (isAdmin) {
    return <AdminDashboard />;
  }

  return <Outlet />;
}

function DashboardIndexWrapper() {
  const navigate = useNavigate();
  return (
    <UserDashboard
      activeTab="overview"
      onTabChange={(tab) => navigate({ to: tab ? (`/dashboard/${tab}` as any) : '/dashboard' })}
      onSelectProperty={(id) => {
        if (id) {
          navigate({ to: '/dashboard/properties/$propertyId', params: { propertyId: id }, search: {} });
        } else {
          navigate({ to: '/dashboard/properties', search: {} });
        }
      }}
      onBrowseProperties={(type) => navigate({ to: type === 'rent' ? '/rent' : '/buy' })}
    />
  );
}

function DashboardTabWrapper() {
  const { tab } = useParams({ from: '/dashboard/$tab' });
  const navigate = useNavigate();

  // If user visits legacy tabs/bookmarks, seamlessly map to My Properties with appropriate section
  const isRentals = tab === 'rentals';
  const isMyRequests = tab === 'my-requests' || tab === 'requests';
  const isIncoming = tab === 'incoming-requests';
  const isTransactions = tab === 'transactions';

  const mappedTab = (isRentals || isMyRequests || isIncoming || isTransactions) ? 'properties' : tab;
  const initialSection: 'owned' | 'rents' | undefined = 
    isRentals || isMyRequests || isTransactions 
      ? 'rents' 
      : isIncoming 
      ? 'owned' 
      : undefined;

  return (
    <UserDashboard
      activeTab={mappedTab}
      initialPropertySection={initialSection}
      onTabChange={(newTab) => navigate({ to: newTab ? (`/dashboard/${newTab}` as any) : '/dashboard' })}
      onSelectProperty={(id) => {
        if (id) {
          navigate({ to: '/dashboard/properties/$propertyId', params: { propertyId: id }, search: {} });
        } else {
          navigate({ to: '/dashboard/properties', search: {} });
        }
      }}
      onBrowseProperties={(type) => navigate({ to: type === 'rent' ? '/rent' : '/buy' })}
    />
  );
}

function DashboardPropertiesWrapper() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { section?: 'owned' | 'rents' };

  return (
    <UserDashboard
      activeTab="properties"
      initialPropertySection={search?.section || 'owned'}
      onTabChange={(newTab) => navigate({ to: newTab ? (`/dashboard/${newTab}` as any) : '/dashboard' })}
      onSelectProperty={(id) => {
        if (id) {
          navigate({
            to: '/dashboard/properties/$propertyId',
            params: { propertyId: id },
            search: search?.section ? { section: search.section } : {}
          });
        } else {
          navigate({
            to: '/dashboard/properties',
            search: search?.section ? { section: search.section } : {}
          });
        }
      }}
      onBrowseProperties={(type) => navigate({ to: type === 'rent' ? '/rent' : '/buy' })}
    />
  );
}

function DashboardPropertyManageWrapper() {
  const { propertyId } = useParams({ from: '/dashboard/properties/$propertyId' });
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { section?: 'owned' | 'rents' };

  return (
    <UserDashboard
      activeTab="properties"
      selectedPropertyId={propertyId}
      initialPropertySection={search?.section}
      onTabChange={(newTab) => navigate({ to: newTab ? (`/dashboard/${newTab}` as any) : '/dashboard' })}
      onSelectProperty={(id) => {
        if (id) {
          navigate({
            to: '/dashboard/properties/$propertyId',
            params: { propertyId: id },
            search: search?.section ? { section: search.section } : {}
          });
        } else {
          navigate({
            to: '/dashboard/properties',
            search: search?.section ? { section: search.section } : {}
          });
        }
      }}
      onBrowseProperties={(type) => navigate({ to: type === 'rent' ? '/rent' : '/buy' })}
    />
  );
}

// --- Protected Admin Guard & Layout ---
function AdminLayoutWrapper() {
  const { user, isInitializing } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: userProfile, isLoading: profileLoading } = useGetCallerUserProfile();
  const { data: isApproved, isLoading: approvalLoading } = useIsCallerApproved();

  const roleToCheck = userProfile?.role || user?.role;
  const internalRoleToCheck = (userProfile as any)?.internalRole || (user as any)?.internalRole;
  const isAdmin = internalRoleToCheck === 'admin' || roleToCheck === 'admin' || roleToCheck === TamilRole.admin;

  useEffect(() => {
    if (!isInitializing && !user) {
      navigate({
        to: '/login',
        search: { redirect: location.pathname + location.search },
      });
    } else if (!isInitializing && user && !profileLoading && !isAdmin) {
      navigate({ to: '/dashboard' });
    }
  }, [user, isInitializing, profileLoading, isAdmin, location.pathname, location.search, navigate]);

  if (isInitializing || (user && profileLoading)) {
    return <LoadingScreen />;
  }

  if (!user || !isAdmin) {
    return null;
  }

  if (!approvalLoading && isApproved === false) {
    return <PendingApprovalScreen />;
  }

  return <Outlet />;
}

function AdminIndexWrapper() {
  return <AdminDashboard />;
}

// --- Route Definitions ---

export const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
});

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <PropertyListingsWrapper />,
});

export const buyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/buy',
  component: () => <PropertyListingsWrapper initialType="buy" />,
});

export const rentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rent',
  component: () => <PropertyListingsWrapper initialType="rent" />,
});

export const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: () => <PropertyListingsWrapper showAbout={true} />,
});

export const propertyBaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/property',
  component: () => <Outlet />,
});

export const propertyDetailRoute = createRoute({
  getParentRoute: () => propertyBaseRoute,
  path: '$propertyId',
  component: PropertyDetailWrapper,
});

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = (search.redirect as string) || undefined;
    return redirect ? { redirect } : {};
  },
  component: () => <LoginPageWrapper defaultView="login" />,
});

export const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const redirect = (search.redirect as string) || undefined;
    return redirect ? { redirect } : {};
  },
  component: () => <LoginPageWrapper defaultView="register" />,
});

export const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: () => <LoginPageWrapper defaultView="forgot-email" />,
});

export const dashboardBaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardLayoutWrapper,
});

export const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardBaseRoute,
  path: '/',
  component: DashboardIndexWrapper,
});

export const dashboardPropertiesRoute = createRoute({
  getParentRoute: () => dashboardBaseRoute,
  path: 'properties',
  validateSearch: (search: Record<string, unknown>): { section?: 'owned' | 'rents' } => {
    const section = (search.section === 'rents' || search.section === 'owned') ? search.section : undefined;
    return section ? { section } : {};
  },
  component: DashboardPropertiesWrapper,
});

export const dashboardPropertyManageRoute = createRoute({
  getParentRoute: () => dashboardPropertiesRoute,
  path: '$propertyId',
  component: DashboardPropertyManageWrapper,
});

export const dashboardTabRoute = createRoute({
  getParentRoute: () => dashboardBaseRoute,
  path: '$tab',
  component: DashboardTabWrapper,
});

export const adminBaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminLayoutWrapper,
});

export const adminIndexRoute = createRoute({
  getParentRoute: () => adminBaseRoute,
  path: '/',
  component: AdminIndexWrapper,
});

export const adminTabRoute = createRoute({
  getParentRoute: () => adminBaseRoute,
  path: '$section',
  component: AdminIndexWrapper,
});

// --- Route Tree & Router ---

const routeTree = rootRoute.addChildren([
  indexRoute,
  buyRoute,
  rentRoute,
  aboutRoute,
  loginRoute,
  registerRoute,
  forgotPasswordRoute,
  propertyBaseRoute.addChildren([propertyDetailRoute]),
  dashboardBaseRoute.addChildren([
    dashboardIndexRoute,
    dashboardPropertiesRoute.addChildren([dashboardPropertyManageRoute]),
    dashboardTabRoute,
  ]),
  adminBaseRoute.addChildren([adminIndexRoute, adminTabRoute]),
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundPage,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
