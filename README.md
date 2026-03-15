# Statement Atlas

Interactive personal finance dashboard for password-protected bank statements.

## What it does

- Parses uploaded PDF statements in the browser.
- Buckets inflows, essentials, non-essentials, investments, transfers, and debt payments.
- Shows multi-year trends when you merge multiple statements.
- Stores the imported profile in browser local storage.
- Supports replace-or-merge imports and per-statement removal.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run start
```

## Railway

- Build command: `npm run build`
- Start command: `npm run start`

`railway.toml` is already included.
