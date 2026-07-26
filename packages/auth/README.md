# @zenith/auth

Authentication and authorization system for Zenith with class-based and functional APIs.

## Installation

```bash
npm install @zenith/auth
```

## Usage

### Functional API (v1.4.0)

```typescript
import { auth, configureAuth, initAuth } from '@zenith/auth';

// Configure endpoints
configureAuth({
  endpoints: {
    login: '/api/v1/auth/login',
    logout: '/api/v1/auth/logout',
    register: '/api/v1/auth/register',
    me: '/api/v1/auth/me'
  },
  loginRedirect: '/dashboard',
  logoutRedirect: '/',
  loginPath: '/login'
});

// Initialize on app start (restores session from storage)
await initAuth();

// Login
const user = await auth.login({ email, password, remember: true });
if (user) {
  console.log('Welcome', user.name);
}

// Check authentication
if (auth.isAuthenticated.get()) {
  console.log('User:', auth.user.get()?.name);
}

// Check roles and permissions
if (auth.hasRole('admin')) {
  // Show admin panel
}
if (auth.hasPermission('users:delete')) {
  // Show delete button
}

// Logout
await auth.logout();
```

### Class-based API

```typescript
import { createAuth } from '@zenith/auth';

const auth = createAuth({
  loginUrl: '/api/auth/login',
  logoutUrl: '/api/auth/logout',
  refreshUrl: '/api/auth/refresh',
  meUrl: '/api/auth/me',
  tokenStorage: 'memory',
  autoRefresh: true,
  refreshThreshold: 300
});

await auth.login({ email, password });
console.log(auth.isAuthenticated);
```

### Route Guards

```typescript
import { canActivateRoute } from '@zenith/auth';

const result = await canActivateRoute({
  requiresAuth: true,
  roles: ['admin'],
  permissions: ['orders:view'],
  redirectTo: '/login'
});

if (!result.allowed) {
  navigate(result.redirectTo);
}
```

## API Reference

### Functional API
- `configureAuth(cfg)` — Configure auth endpoints and behavior
- `initAuth()` — Initialize auth and restore session
- `auth.login(credentials)` — Login user
- `auth.logout()` — Logout user
- `auth.register(data)` — Register new user
- `auth.refreshToken()` — Refresh access token
- `auth.fetchUser()` — Fetch current user
- `auth.hasRole(role)` — Check if user has role
- `auth.hasAnyRole(roles)` — Check if user has any of the roles
- `auth.hasAllRoles(roles)` — Check if user has all roles
- `auth.hasPermission(perm)` — Check if user has permission
- `auth.hasAnyPermission(perms)` — Check if user has any permission
- `canActivateRoute(guard)` — Check route guard

### Class-based API
- `createAuth(config)` — Create Auth instance
- `Auth.login(credentials)` — Login
- `Auth.logout()` — Logout
- `Auth.fetchUser()` — Fetch user
- `Auth.refresh()` — Refresh token
- `Auth.isAuthenticated` — Getter
- `Auth.user` — Getter
- `Auth.token` — Getter
