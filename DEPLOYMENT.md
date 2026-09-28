# Production deployment

The frontend is built by GitHub Actions and published as
`ghcr.io/biqxx/limitra-fe:main`. `NEXT_PUBLIC_API_URL` is a browser-visible
build-time value and is fixed to `https://api.limitra.com.ng/api/v1` in the
workflow.

## EC2 layout

The service uses the existing external Docker network `platform_edge`. Nginx
can reach it at `http://limitra-frontend:3000`; the application does not need
the PostgreSQL or Redis network.

Install the deployment files in `/opt/platform/apps/limitra-fe`, sign in to
GHCR if the package is private, and run:

```sh
docker compose -f compose.production.yml pull frontend
docker compose -f compose.production.yml up -d frontend
```

The shared Nginx service should proxy both `limitra.com.ng` and
`www.limitra.com.ng` to `limitra-frontend:3000`, preserving the host and
forwarded headers. Keep TLS termination in the shared Nginx container.

## API integration status

Authentication, profile, signed-in carts, favourites, and order creation use
the Limitra NG API. The current public catalogue, admin and affiliate screens,
order history/tracking, address/card UI, and Lucy assistant still contain
local or prototype data and require separate application work.
