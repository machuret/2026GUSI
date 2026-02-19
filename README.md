# GUSI — AI Content Generator

An AI-powered content generation tool that learns from a company's existing content history and replicates their unique voice, tone, and style when creating new content.

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── content/
│   │   │   ├── ingest/route.ts    — POST: save historical posts & documents
│   │   │   ├── generate/route.ts  — POST: generate new content in company voice
│   │   │   └── history/route.ts   — GET:  list all generated content
│   │   └── style/
│   │       └── analyze/route.ts   — POST: build/update StyleProfile via OpenAI
│   ├── ingest/page.tsx            — Form to paste past posts
│   ├── generate/page.tsx          — Main generation interface
│   ├── history/page.tsx           — Browse generated content
│   ├── layout.tsx                 — Root layout with sidebar navigation
│   ├── globals.css
│   └── page.tsx                   — Dashboard
├── components/
│   └── Sidebar.tsx
└── lib/
    ├── prisma.ts                  — Prisma client singleton
    ├── openai.ts                  — OpenAI client singleton
    └── styleAnalyzer.ts           — Extracts style patterns from posts

prisma/
└── schema.prisma                  — Database models
```

## How Style Learning Works

1. **Ingest** — The user pastes or uploads their company's past social media posts, blog articles, and documents via `/ingest`. These are stored in the `ContentPost` and `Document` tables.

2. **Analyze** — When the user triggers style analysis (`POST /api/style/analyze`), the system:
   - Retrieves up to 50 recent posts and 10 documents for the company
   - Sends them to OpenAI with a structured prompt asking it to extract: tone, signature vocabulary, common phrases, preferred content formats, and average word count
   - Saves the result as a `StyleProfile` in the database

3. **Generate** — When generating new content (`POST /api/content/generate`), the system:
   - Loads the company's `StyleProfile`
   - Retrieves the 5 most recent posts as concrete examples
   - Builds a system prompt that instructs the AI to write exactly in the company's voice, matching their tone, vocabulary, sentence structure, and formatting patterns
   - The user's prompt is sent as the user message
   - The output is saved to `GeneratedContent` for future reference

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (or use a hosted provider like Supabase, Neon, etc.)
- OpenAI API key

### Installation

```bash
cd C:\2026GUSI
npm install
```

### Environment Variables

Copy `.env.local` and fill in real values:

```env
OPENAI_API_KEY=sk-your-key-here
DATABASE_URL="postgresql://user:password@host:5432/gusi?schema=public"
NEXTAUTH_SECRET=generate-a-random-secret
NEXTAUTH_URL=http://localhost:3000
```

### Database Setup

```bash
npx prisma db push
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy to Vercel

1. Push this repo to GitHub
2. Import into Vercel
3. Set environment variables in the Vercel dashboard
4. Vercel will auto-detect Next.js and deploy

## Database Models

| Model | Purpose |
|---|---|
| **Company** | Organization profile |
| **ContentPost** | Historical posts the system learns from |
| **Document** | Uploaded PDFs, docs, brand guides |
| **StyleProfile** | The learned style fingerprint (tone, vocabulary, formats) |
| **GeneratedContent** | All AI-generated content with approval status |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL via Prisma ORM
- **AI**: OpenAI GPT-4o-mini
- **Deployment**: Vercel
- **Validation**: Zod
- **Icons**: Lucide React
