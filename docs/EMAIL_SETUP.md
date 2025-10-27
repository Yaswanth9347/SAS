# Email Setup for Production and Staging

This guide ensures reliable email delivery and compliance for SAS. Complete all steps before go-live.

## 1) Required environment variables

Set these in your secret store (production/staging) and .env files for local/testing:

- EMAIL_HOST (e.g., smtp.sendgrid.net, email-smtp.us-east-1.amazonaws.com)
- EMAIL_PORT (465 for SSL, or 587 for STARTTLS)
- EMAIL_USER (SMTP username or API user)
- EMAIL_PASSWORD (SMTP password or API key)
- FROM_NAME (Display name, e.g., "Spread A Smile")
- FROM_EMAIL (Verified sender, e.g., no-reply@your-domain.example)
- FRONTEND_URL (Origin where reset links should point, e.g., https://app.your-domain.example)

The app enforces these in production/staging. Missing values will cause email sending to fail with server-side logging and generic client errors.

## 2) Domain authentication (SPF/DKIM/DMARC)

Configure DNS on your sending domain (the domain part of FROM_EMAIL):

- SPF (TXT on root domain):
  v=spf1 include:sendgrid.net include:amazonses.com ~all

  Use includes for your chosen provider(s). Keep only the providers you use.

- DKIM:
  Add the DKIM CNAME/TXT records provided by your email provider. Example (provider-specific):
  s1._domainkey.your-domain.example -> provider DKIM record
  s2._domainkey.your-domain.example -> provider DKIM record

- DMARC (TXT on _dmarc.your-domain.example):
  v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@your-domain.example; ruf=mailto:dmarc-forensics@your-domain.example; fo=1; adkim=s; aspf=s

  After validating traffic, you can move to p=reject.

## 3) Verification checklist

- Verify sender identity (FROM_EMAIL) in your provider console.
- Send a test email to Gmail and Outlook; confirm SPF=pass, DKIM=pass, DMARC=pass in the headers.
- Ensure emails land in Inbox (not Spam) for at least one common provider.

## 4) Password reset flow

- Client: Request reset → server generates token (1-hour expiry) → email contains link to `${FRONTEND_URL}/reset-password.html?token=...`.
- Server behavior:
  - Returns generic success even if email not found (prevents enumeration).
  - If email sending fails or config is missing in prod/staging, logs the error server-side and returns a generic error; reset token is not exposed to the client.

## 5) Notification preferences

- In-app notifications always persist in the database.
- Emails send only if `user.userPreferences.notifications.email` is true (default true unless the user disables it).

## 6) Logging and privacy

- Server logs include masked emails and generic error codes for email failures.
- Client-facing errors are generic and never include provider details.

## 7) Operational tips

- Rotate SMTP/API keys regularly and upon team changes.
- Monitor bounce/complaint rates in provider console.
- Maintain separate senders or IP pools for transactional vs bulk mails.

## 8) Troubleshooting

- 550/5xx rejections: Confirm SPF/DKIM alignment and DMARC policy.
- TLS errors: Use port 465 for implicit SSL or 587 with STARTTLS; ensure TLS v1.2 is enabled.
- Rate-limits: Respect provider sending limits; add exponential backoff in batch processes if needed.
