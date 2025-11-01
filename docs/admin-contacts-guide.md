# Admin Contacts Management Guide

This guide explains how to manage contact form submissions from the Admin UI, including searching, viewing details, replying, archiving, deleting, and performing bulk actions.

## Accessing the Admin Contacts Page

- Open `frontend/admin-contacts.html` in your deployment.
- Admin role is required.

## Dashboard Stats

- The top panel shows totals by status: New, Read, Replied, and Archived.
- Stats update automatically after you take actions (reply/archive/delete) and when you open a message (mark as read).

## Searching & Filtering

- Use the search box to filter by name, email, or subject; press Enter or click Apply.
- Use the Status dropdown to filter by message status.
- Click Clear to reset all filters.

## Listing & Selection

- The table lists incoming messages with sender info, subject, message preview, status, date, and actions.
- Select messages with the left column checkboxes; the Select All checkbox toggles all visible rows.
- Bulk action buttons (Archive/Delete) enable when at least one message is selected.

## View Message & Mark as Read

- Click View to open the full message.
- New messages are automatically marked as Read when opened.
- If the message already has a reply, a reply history block appears in the details.

## Reply to a Message

- Click Reply to open the reply composer.
- Replies require at least 10 characters.
- After sending, the message status becomes Replied; the dashboard stats refresh.

## Archive or Delete

- Archive: moves the message to the Archived state (non-destructive; can be listed via filters).
- Delete: permanently removes the message. You’ll be asked to confirm before deletion.

## Bulk Actions

- Select multiple messages and click Archive Selected or Delete Selected.
- Bulk archive runs via a single API call that updates all selected IDs.
- Bulk delete iterates through selected IDs and deletes each safely; failures for individual IDs are skipped with a warning and the operation continues.

## Troubleshooting

- If an action fails due to network issues, try again; the UI will show an error toast if the operation could not be completed.
- If the table shows no results, adjust your filters or clear them to see all messages.
