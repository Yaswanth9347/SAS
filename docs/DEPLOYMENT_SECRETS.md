# Deployment Secrets: Staging and Production

Use your platform's secret store to configure environment variables. Do not commit real secrets to the repository.

## Required variables (email + frontend)

Set these in both staging and production:

- EMAIL_HOST
- EMAIL_PORT
- EMAIL_USER
- EMAIL_PASSWORD
- FROM_NAME
- FROM_EMAIL (must be a verified sender on your domain; do not use Gmail/Outlook/Yahoo)
- FRONTEND_URL (must be HTTPS and not localhost in staging/production)

Refer to docs/EMAIL_SETUP.md for domain DNS (SPF/DKIM/DMARC) requirements.

## Suggested additional variables

- NODE_ENV (staging or production)
- MONGODB_URI (and backups/replicas as needed)
- JWT_SECRET (strong, random)
- LOG_LEVEL (info/warn/error)

## Platform-specific pointers

### Docker / Docker Compose

In your compose file or orchestrator:
- Use an external secrets manager or pass env via environment section referencing a secret store.
- Example (compose):
  environment:
    - NODE_ENV=production
    - EMAIL_HOST=${EMAIL_HOST}
    - EMAIL_PORT=${EMAIL_PORT}
    - EMAIL_USER=${EMAIL_USER}
    - EMAIL_PASSWORD=${EMAIL_PASSWORD}
    - FROM_NAME=${FROM_NAME}
    - FROM_EMAIL=${FROM_EMAIL}
    - FRONTEND_URL=${FRONTEND_URL}

### GitHub Actions (for deployment pipelines)

- Add repository Secrets in Settings > Secrets and variables > Actions.
- Reference them as ${{ secrets.VAR_NAME }} in your workflow and pass to the deployment target.

### Render / Railway / Fly.io / Heroku

- Use the dashboard to add Environment Variables under project/service settings.
- Set NODE_ENV to staging or production accordingly.
- Restart the service after updating secrets.

### AWS (ECS/EKS/Elastic Beanstalk)

- Store values in AWS Secrets Manager or SSM Parameter Store.
- Reference them in your task definitions or environment configuration.

### Vercel / Netlify

- For the backend service (if hosted), add Environment Variables in project Settings.
- Use separate environments (Preview/Staging/Production) with distinct values.

## Verification workflow

1) Set the variables in your secret store for the target environment.
2) Deploy/restart the backend service.
3) Run the verifier inside the environment or against a shell with the same env:

   node backend/scripts/verify-email-env.js

4) Send a password reset and check that the email arrives with SPF=pass, DKIM=pass, DMARC=pass.

## Tips

- Use scoped/rotatable API keys for EMAIL_USER/EMAIL_PASSWORD.
- FROM_EMAIL should be on the same domain configured with SPF/DKIM/DMARC.
- Keep staging and production secrets separate; never reuse.
