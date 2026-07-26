# @zenith/http

Advanced HTTP client for Zenith framework with interceptors, caching, retry, and cancellation.

## Installation

```bash
npm install @zenith/http
```

## Usage

### Basic Request

```typescript
import { http, request } from '@zenith/http';

// Simple GET
const { data } = await http.get<User>('/users/123');

// POST with body
const { data } = await http.post<Session>('/login', { email, password });

// Generic request
const response = await request<Product>({
  url: '/api/products',
  method: 'GET',
  params: { category: 'electronics' }
});
```

### Global Configuration

```typescript
import { setHttpConfig, addRequestInterceptor, addErrorInterceptor } from '@zenith/http';

// Base configuration
setHttpConfig({
  baseURL: 'https://api.example.com',
  timeout: 15000
});

// Request interceptor for auth token
addRequestInterceptor((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`
    };
  }
  return config;
});

// Error interceptor for 401 handling
addErrorInterceptor((error) => {
  if (error.status === 401) {
    window.location.href = '/login';
  }
});
```

### Reactive Resource

```typescript
import { http } from '@zenith/http';

// Create a reactive resource — data, loading, and error are all Signals
const users = http.resource<User[]>('/users');

// Use in templates:
// <div zen-if="users.loading">Loading...</div>
// <div zen-if="users.error">Error: {{ users.error.message }}</div>
// <ul zen-for="user in users.data">...</ul>

// Refresh manually
users.refresh();
```

### Caching

```typescript
const cachedData = await http.get('/products', {
  cache: { enabled: true, ttl: 30000 }
});
```

### Cancellation

```typescript
import { cancelRequest } from '@zenith/http';

const controller = new AbortController();
http.get('/slow-endpoint', { signal: controller.signal });

// Cancel the request
cancelRequest(controller);
```

## API Reference

- `request<T>(options)` — Generic HTTP request
- `http.get<T>(url, options?)` — GET request
- `http.post<T>(url, body, options?)` — POST request
- `http.put<T>(url, body, options?)` — PUT request
- `http.patch<T>(url, body, options?)` — PATCH request
- `http.delete<T>(url, options?)` — DELETE request
- `http.resource<T>(url, options?)` — Reactive resource
- `setHttpConfig(config)` — Set global defaults
- `addRequestInterceptor(fn)` — Register request interceptor
- `addResponseInterceptor(fn)` — Register response interceptor
- `addErrorInterceptor(fn)` — Register error interceptor
- `clearCache()` — Clear response cache
- `cancelRequest(controller)` — Cancel an in-flight request
- `cancelAllRequests()` — Cancel all active requests
