# @zenith/notifications

Toast, alert, and confirm notification system for Zenith.

## Installation

```bash
npm install @zenith/notifications
```

## Usage

### Basic Notifications

```typescript
import { notify, toasts, alert, confirm, setNotificationDefaults } from '@zenith/notifications';

// Default settings
setNotificationDefaults({
  position: 'top-right',
  duration: 3000
});

// Simple toast
notify('Welcome!', { type: 'success' });

// Convenience methods
toasts.success('Operation completed');
toasts.error('Server connection failed');
toasts.warning('This action cannot be undone');
toasts.info('New version available');

// Toast with action button
notify('Your file is ready', {
  type: 'success',
  title: 'Download Ready',
  actions: [
    { label: 'Download', onClick: () => downloadFile() }
  ]
});

// Persistent notification
notify('System update in progress', {
  type: 'info',
  persistent: true
});
```

### Alerts and Confirms

```typescript
// Alert
await alert({
  title: 'Attention',
  message: 'This will delete all your data',
  type: 'warning'
});

// Confirm
const confirmed = await confirm({
  title: 'Delete Item',
  message: 'Are you sure you want to delete this item?',
  confirmText: 'Yes, delete',
  cancelText: 'No',
  type: 'error'
});

if (confirmed) {
  await api.deleteItem(itemId);
  toasts.success('Item deleted successfully');
}
```

### Via Zen Runtime

```typescript
import { Zen } from '@zenith/runtime';

Zen.toasts.success('Message via Zen');
await Zen.confirm('Do you want to continue?');
```

## API Reference

- `notify(message, options?)` — Show a toast notification
- `toasts.success(message)` — Success toast
- `toasts.error(message)` — Error toast
- `toasts.warning(message)` — Warning toast
- `toasts.info(message)` — Info toast
- `alert(options)` — Show alert dialog
- `confirm(options)` — Show confirm dialog
- `setNotificationDefaults(defaults)` — Set global defaults
