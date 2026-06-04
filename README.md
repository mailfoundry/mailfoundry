# MailFoundry

MailFoundry is an internal email campaign platform built first for Staffordshire Wood Fuels.

It currently supports:

- Contacts
- Lists
- Campaigns
- Campaign preview
- Test sends
- Full campaign sends via AWS SES
- Send logging
- Reports
- Unsubscribe flow
- Contact suppression handling
- Internal login protection
- Environment/settings dashboard

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Prisma
- Neon PostgreSQL
- AWS SES

## Local Development

Start the development server:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run dev
```
