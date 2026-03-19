---
description: Deploy Supabase edge functions after making local changes
---

IMPORTANT: GitHub push only deploys the Next.js app to Vercel. Edge function changes MUST be deployed separately via the Supabase CLI. Run this every time you edit any file in `supabase/functions/`.

// turbo
1. Deploy all grant-related edge functions:
```
npx supabase functions deploy grant-profile grant-audit grant-improve --no-verify-jwt
```

// turbo
2. Verify deployment (check versions incremented):
```
npx supabase functions list
```

If you only changed one function, deploy just that one:
```
npx supabase functions deploy <function-name> --no-verify-jwt
```
