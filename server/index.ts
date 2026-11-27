/**
 * Serves the built app. There is no backend: tables are converted in the
 * browser and never sent here.
 */
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import { existsSync } from "node:fs"
import { extname } from "node:path"
import { fileURLToPath } from "node:url"
import { Hono } from "hono"
import { compress } from "hono/compress"
import { secureHeaders } from "hono/secure-headers"

const dist = fileURLToPath(new URL("../dist", import.meta.url))
const port = Number(process.env.PORT ?? 3000)
const hostname = process.env.HOST ?? "127.0.0.1"

if (!existsSync(dist)) {
  console.error("The app isn't built yet. Run `npm run build` first.")
  process.exit(1)
}

const app = new Hono()

app.use(compress())
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // The UI libraries position popups and toasts with inline styles.
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'self'"],
    },
  })
)

app.get("/healthz", (c) => c.text("ok"))

app.use(
  "*",
  serveStatic({
    root: dist,
    onFound: (_path, c) => {
      // Built assets have a content hash in their names, so they never change.
      const immutable = c.req.path.startsWith("/assets/")
      c.header("Cache-Control", immutable ? "public, max-age=31536000, immutable" : "no-cache")
    },
  })
)

// Paths that look like files and weren't found are real 404s; anything else gets the app.
app.get("*", async (c, next) => {
  if (extname(c.req.path) !== "") return c.notFound()
  c.header("Cache-Control", "no-cache")
  return serveStatic({ root: dist, path: "index.html" })(c, next)
})

const server = serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`tableflip is running at http://${info.address}:${info.port}`)
})

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
  })
}
