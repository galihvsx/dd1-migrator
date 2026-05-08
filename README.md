# dd1-migrator

Interactive CLI to execute Drizzle SQL migrations on Cloudflare D1.

## Features

- Auto-detects D1 bindings from `wrangler.jsonc` / `wrangler.json`
- Arrow-key selection for database, migration file, and target
- Supports local and remote execution
- Zero dependencies — uses only Node.js built-ins

## Install

```bash
npm i -D github:galihvsx/dd1-migrator
# or
bun add -D github:galihvsx/dd1-migrator
```

## Usage

Run in a project that has a `drizzle/` folder with `.sql` migration files and a `wrangler.jsonc` / `wrangler.json`:

```bash
npx dd1-migrator
```

Or add to `package.json` scripts:

```json
{
  "scripts": {
    "db:execute": "dd1-migrator"
  }
}
```

### Flow

1. **Select D1 database** — auto-detected from wrangler config, or enter manually
2. **Select migration file** — lists `*.sql` in `drizzle/`
3. **Select target** — Local or Remote
4. Executes `npx wrangler d1 execute <binding> --file <file> --local|--remote`

## License

MIT
