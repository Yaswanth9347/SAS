# Admin User Management Guide

This guide explains how to manage users from the Admin UI, including searching, filtering, bulk actions, and reviewing activity.

## Accessing the Admin Users Page

- Navigate to `frontend/admin-users.html` in your deployment.
- You must be an administrator to access this page.

## Searching & Filtering

- Search bar: type a name, username, or email to filter users. The list updates after a brief pause.
- Filters:
  - Role: Admin or Volunteer
  - Status: approved, pending, rejected
  - Verified: true/false
- Active filters are shown as removable “chips” below the filter bar.
- Filters and pagination are preserved in the URL so you can share the exact view.

## Pagination

- Use page controls at the bottom to navigate.
- Select the page size from the “Items per page” dropdown.

## Individual Actions

- Approve: Approves a pending user.
- Reject: Prompts for a reason and marks the user as rejected.
- Change Role: Switch between Admin and Volunteer.
- View Details: Opens a modal with profile information.
- View Logs: Opens recent activity for the selected user.
- Delete: Requires typing `DELETE` to confirm permanent deletion.

## Bulk Actions

- Select users with the checkboxes in the left column; a bulk toolbar appears.
- Available bulk actions:
  - Approve selected
  - Reject selected (prompts for a reason)
  - Change role for selected
  - Delete selected (destructive)
- Use “Select all matching” to select all users across pages that match the current filters. This is server-assisted and fetches only IDs from the backend for efficiency. If your selection exceeds 5,000 users, you’ll be asked to confirm before proceeding.
- Long operations run in chunks and display progress. You can Abort to cancel in-flight requests immediately.
- When partial failures occur, a summary modal shows details and offers a Retry for delete failures.

### Idempotent bulk operations (safe retries)

- Bulk update operations (approve/reject/change role) include a client-generated idempotency key that the server honors.
- If a request is retried due to network blips, the server detects the duplicate key and returns the original result instead of applying the changes twice.
- This makes it safe to refresh or re-run a failed bulk update without creating duplicates.

### Accessibility

- Key UI changes are announced via an aria-live region (e.g., when a selection is made or cleared, and when a bulk operation completes).
- Keyboard navigation is supported in modals; Escape closes the summary dialog or requests abort when a bulk is in progress.

## Admin Stats & Activity

- Open `frontend/admin-stats.html` for an overview of key stats and the activity log.
- Click a stat card (e.g., Active Volunteers) to jump to the Admin Users page filtered for that cohort.
- Stats are cached briefly to improve performance and auto-refresh when user actions occur.

### Select-all at scale

- The “Select all matching” button uses a GET /api/admin/users/ids endpoint to retrieve just the matching user IDs in large pages (10,000 IDs per request) to keep memory use low.
- Visible rows on the current page are kept in sync with the overall selection set.
- You can clear the selection with the “Clear” action in the bulk toolbar.

## Tips

- Use filter chips to quickly remove filters.
- Watch the total count and page size to understand how many users match your filters.
- For very large selections, consider performing bulk actions in smaller chunks.

## Troubleshooting

- If actions fail due to network issues, try again or use the Retry button in the summary modal (for deletes).
- If the list appears out of date, refresh the page or change a filter to reload.

