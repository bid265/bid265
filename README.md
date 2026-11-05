This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
create a folder called .devcontainer in the root folder of codespace
create a file called devcontainer.json in the .devcontainer folder as [project folder]/.devcontainer/devcontainer.json
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Marketplace and account roles

The landing page links to public daily-sale goods, property categories, and scheduled/live auctions. The marketplace supports category, price, auctioneer, location, and (for properties) sale/lease filters. Purchasing a daily-sale good or property requires a bidder account. Public registration always creates a bidder; administrators create auctioneer accounts from the administrator dashboard after verifying the auctioneer's contact and address details. Auctioneers can change their initial administrator-provided password under Dashboard → Settings; the change requires the current password and a new password of at least 12 characters.

Auctioneers can create, edit, and archive their own daily sales, scheduled auctions, and sale/lease properties from the dashboard. Auctions become read-only once bidding starts or a bidder registers or pays; active auctions cannot be archived. Archiving hides a listing from public pages while retaining its transaction history.

## Auction settlement and email

Apply database migrations with `npm run db:migrate` before deploying schema changes. Listing photos are stored as binary data in PostgreSQL and served through `/api/images`; new uploads must be JPEG, PNG, WebP, or GIF and no larger than 3.5 MB. To preserve photos already saved under `public/uploads`, run `npm run db:migrate-uploads` after the schema migration and from a checkout that still contains those files and has the same `DATABASE_URL`, before deploying to Vercel. Live-auction controls allow auctioneers to disclose the reserve price and extend active auctions by 5, 10, or 20 seconds. Auctions close automatically after their scheduled end time, even if the auctioneer leaves the live room; auctioneers can re-enter while the auction remains within its scheduled window. On Vercel Hobby, the built-in `/api/cron/auction-settlements` job is a daily fallback, so configure an external scheduler to request `GET https://<your-domain>/api/cron/auction-settlements` every minute with `Authorization: Bearer <CRON_SECRET>` for prompt expiration. Below-reserve auctions wait in the auctioneer dashboard for an explicit accept/decline decision before settlement and refunds are processed.

Settlement creates an administrator refund queue for unsuccessful bidders' paid bidding deposits and any unused winning deposit. These refunds are **not automatically transferred**: an administrator must issue each payout through PayChangu and record its payout reference in the dashboard. Auction result and refund status emails use the SMTP variables in `.env.example` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`). Configure them in the deployment environment; do not commit credentials.

## Google sign-in and administrator setup

Google sign-in uses NextAuth's Google provider. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in the environment and allow `https://<your-domain>/api/auth/callback/google` in Google Cloud Console. Google users are bidders by default; an account already registered as an administrator retains its administrator role when signing in with the same Google email.

To create or promote an administrator, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (at least 12 characters) in the environment, then run `npm run seed:admin`. The command creates an administrator if that email is new, or promotes the matching account and updates its password if it already exists. Keep these values private and remove them from the environment after seeding. Sign in with Google using the same email or use the seeded password to access the administrator dashboard and monitor auctioneer accounts and refunds.
