import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { config } from "./config/index.js";

const port = config.app.port;

console.log(`Starting ${config.app.name} in ${config.app.env} mode...`);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`🚀 Server is running on http://localhost:${info.port}${config.app.apiPrefix}`);
  }
);
