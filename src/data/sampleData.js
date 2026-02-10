export const SAMPLE_CONSOLE = [
  { type: 'log', text: 'App initialized successfully', time: '10:30:12' },
  { type: 'info', text: 'Connected to WebSocket server', time: '10:30:13' },
  { type: 'warn', text: 'Deprecated API call: navigator.vibrate()', time: '10:30:14' },
  { type: 'error', text: "Uncaught TypeError: Cannot read properties of undefined (reading 'map')", time: '10:30:15' },
  { type: 'log', text: 'Fetching user data from /api/users', time: '10:30:16' },
  { type: 'log', text: '{ id: 1, name: "John Doe", email: "john@example.com" }', time: '10:30:17' },
  { type: 'warn', text: 'Large DOM detected: 1,247 nodes', time: '10:30:18' },
  { type: 'error', text: 'Failed to load resource: net::ERR_CONNECTION_REFUSED', time: '10:30:19' },
];

export const SAMPLE_NETWORK = [
  { method: 'GET', url: '/api/users', status: 200, size: '1.2 KB', time: '120ms' },
  { method: 'POST', url: '/api/auth/login', status: 200, size: '340 B', time: '245ms' },
  { method: 'GET', url: '/api/products?page=1&limit=20', status: 200, size: '4.5 KB', time: '89ms' },
  { method: 'PUT', url: '/api/users/42', status: 200, size: '220 B', time: '156ms' },
  { method: 'DELETE', url: '/api/sessions/old', status: 204, size: '0 B', time: '67ms' },
  { method: 'GET', url: '/api/analytics', status: 403, size: '120 B', time: '45ms' },
  { method: 'POST', url: '/api/upload', status: 500, size: '85 B', time: '2.1s' },
  { method: 'GET', url: '/styles/main.css', status: 304, size: '0 B', time: '12ms' },
];

export const SAMPLE_GIT_FILES = [
  { name: 'src/App.jsx', status: 'modified' },
  { name: 'src/index.css', status: 'modified' },
  { name: 'src/utils/api.js', status: 'added' },
  { name: 'tests/old.test.js', status: 'deleted' },
];

export const SAMPLE_WORKSPACES = [
  { id: 1, name: 'API Testing Project', tabs: 4, lastOpened: '2 hours ago', tag: 'Work' },
  { id: 2, name: 'Frontend Redesign', tabs: 7, lastOpened: 'Yesterday', tag: 'Personal' },
  { id: 3, name: 'Bug Investigation #421', tabs: 3, lastOpened: '3 days ago', tag: 'Debug' },
];
