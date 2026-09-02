# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Backend demo

The project includes a zero-dependency Node API under `server/`. It stores local demo data in `server/data/db.json` and exposes:

- `GET /api/health`
- `POST /api/auth/demo`
- `GET /api/wardrobe`, `POST /api/wardrobe`, `PATCH/DELETE /api/wardrobe/:id`
- `GET /api/outfits`, `POST /api/outfits/:id/wear`
- `POST /api/feedback`

Run the API in one terminal with `npm run server`, then run the Vite app with `npm run dev`. Vite proxies `/api` to port `8787` during development. For a single production process, run `npm start`; the Node server will serve both `dist/` and the API. The included `Dockerfile` can be deployed to any container-compatible hosting service.

### Docker deployment

On a server with Docker Compose installed:

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:8787/api/health
```

The `server/data` directory is mounted into the container, so the demo JSON database survives image rebuilds. Back it up before updates:

```bash
cp server/data/db.json "server/data/db.$(date +%Y%m%d-%H%M%S).json"
docker compose up -d --build
docker compose logs --tail=100 zhiwen
```

For public access, keep port `8787` private and put Nginx or another HTTPS reverse proxy in front of it on ports `80` and `443`.

The `deploy/nginx.conf.example` file is a starting point for the Nginx site configuration. Replace its `server_name`, enable the site, then use Certbot to add HTTPS after DNS points to the server.

### API smoke test

With the API running locally or in a server shell, run:

```bash
npm run test:api
```

The test checks health, authentication, seeded wardrobe/outfit data, and wardrobe create/update/delete behavior.
