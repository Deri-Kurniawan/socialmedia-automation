# Social Media Automation

A Next.js application with Better Auth, Google OAuth, Drizzle ORM (SQLite), and Shadcn UI for social media automation with YouTube integration support.

## Features

- **Authentication**: Google OAuth via Better Auth with YouTube API scopes
- **Database**: Drizzle ORM with SQLite (better-sqlite3)
- **UI Components**: Shadcn UI with Tailwind CSS
- **Route Protection**: Protected dashboard with automatic redirects
- **YouTube Integration**: Ready for YouTube API integration (upload, read channel data)

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/auth/[[...all]]/   # Better Auth API routes
│   │   ├── dashboard/             # Protected dashboard page
│   │   ├── login/                 # Login page with Google OAuth
│   │   └── page.tsx               # Home (redirects to login/dashboard)
│   ├── components/ui/             # Shadcn UI components
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── index.ts           # Better Auth server configuration
│   │   │   └── client.ts          # Better Auth client hooks
│   │   └── db/
│   │       ├── index.ts           # Database connection
│   │       └── schema.ts          # Drizzle ORM schema
│   └── middleware.ts              # Route protection middleware
├── drizzle/                       # Migration files
├── .env                           # Environment variables
└── drizzle.config.ts              # Drizzle configuration
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

- `BETTER_AUTH_SECRET`: Random secret key (generate with `openssl rand -base64 32`)
- `BETTER_AUTH_URL`: Your app URL (e.g., `http://localhost:3000`)
- `GOOGLE_CLIENT_ID`: From Google Cloud Console
- `GOOGLE_CLIENT_SECRET`: From Google Cloud Console
- `NEXT_PUBLIC_APP_URL`: Your app URL

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the YouTube Data API v3
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Configure consent screen with required scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/youtube.readonly`
   - `https://www.googleapis.com/auth/youtube.upload`
6. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
7. Copy Client ID and Client Secret to `.env`

### 4. Database Setup

Generate and run migrations:

```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate
```

Or use Drizzle Kit push for development:

```bash
npm run db:push
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:generate` - Generate Drizzle migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:push` - Push schema changes (dev only)
- `npm run db:studio` - Open Drizzle Studio (database GUI)

## Authentication Flow

1. User visits `/` → Redirects to `/login` or `/dashboard` (if authenticated)
2. User clicks "Sign in with Google" on `/login`
3. Better Auth handles OAuth flow with Google
4. User is redirected to `/dashboard` after successful login
5. Session is managed via HTTP-only cookies

## Database Schema

The following tables are created by Better Auth:

- **user**: User profiles (id, name, email, image, etc.)
- **session**: Active sessions (token, expiresAt, userId, etc.)
- **account**: OAuth accounts (provider, accessToken, refreshToken, etc.)
- **verification**: Verification tokens (email verification, password reset)

## YouTube Integration

The Google OAuth configuration includes YouTube scopes for future integration:

- `youtube.readonly`: Read channel data, playlists, videos
- `youtube.upload`: Upload videos to YouTube

Access tokens are stored in the `account` table and can be used to make YouTube API calls.

## Protected Routes

- `/dashboard` - Requires authentication (server-side check in layout.tsx)
- `/api/auth/*` - Better Auth API routes (always accessible)
- `/login` - Public (redirects to dashboard if already logged in)

## Adding More OAuth Providers

To add more providers (e.g., Twitter, Facebook):

1. Update `src/lib/auth/index.ts`:

```typescript
export const auth = betterAuth({
  // ... existing config
  socialProviders: {
    google: { /* ... */ },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    },
  },
});
```

2. Add provider button in `src/app/login/page.tsx`

## Customization

### Styling

- Global styles: `src/app/globals.css`
- Tailwind config: Uses CSS-based config (Tailwind v4)
- UI Components: `src/components/ui/`

### Database

- Schema: `src/lib/db/schema.ts`
- Connection: `src/lib/db/index.ts`
- Migrations: `drizzle/` directory

### Auth Configuration

- Server config: `src/lib/auth/index.ts`
- Client hooks: `src/lib/auth/client.ts`

## License

MIT

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
