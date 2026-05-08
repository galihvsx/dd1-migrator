# dd1-migrator

Interactive CLI to execute Drizzle SQL migrations on Cloudflare D1.

## Features

- Auto-detects D1 bindings from `wrangler.jsonc` / `wrangler.json`
- Arrow-key selection for database, migration file, and target
- Supports local and remote execution
- Zero dependencies — uses only Node.js built-ins

## Usage

Run in a project that has a `drizzle/` folder with `.sql` migration files and a `wrangler.jsonc`:

```bash
npx dd1-migrator
```

### Flow

1. **Select D1 database** — detected from wrangler config, or enter manually
2. **Select migration file** — lists `*.sql` in `drizzle/`
3. **Select target** — Local or Remote
4. Executes `npx wrangler d1 execute <binding> --file <file> --local|--remote`

## Install globally (optional)

```bash
npm i -g dd1-migrator
```

Then just run:

```bash
dd1-migrator
```

## License

MIT
