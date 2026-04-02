/**
 * server.js
 * Express server wiring for the document signing system backend.
 *
 * Responsibilities:
 * - Configure CORS and JSON body parsing
 * - Mount API routes under /api
 * - Provide consistent error responses
 * - Start server on PORT (default 3001)
 */

const express = require("express");
const cors = require("cors");
const apiRouter = require("./routes/api");

/**
 * Creates and configures the Express application.
 * @returns {import("express").Express} Configured Express app instance.
 */
function createApp() {
  const app = express();

  // Allow cross-origin requests (frontend -> backend).
  app.use(cors());

  // Parse JSON payloads; keep a reasonable size limit for documents/keys.
  app.use(express.json({ limit: "1mb" }));

  // Mount API router at /api.
  app.use("/api", apiRouter);

  // 404 handler for unknown routes.
  app.use((req, res) => {
    res.status(404).json({
      error: {
        message: "Not Found"
      }
    });
  });

  /**
   * Global error handler: enforces consistent error shape.
   * IMPORTANT: In Express, error middleware must have 4 args.
   */
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const statusCode =
      typeof err?.statusCode === "number" ? err.statusCode : 500;

    // Avoid leaking internal stack traces by default.
    const message =
      statusCode >= 500
        ? "Internal Server Error"
        : err?.message || "Request failed";

    const payload = {
      error: {
        message
      }
    };

    // Only include details if explicitly provided (useful for 4xx).
    if (err && Object.prototype.hasOwnProperty.call(err, "details")) {
      payload.error.details = err.details;
    }

    res.status(statusCode).json(payload);
  });

  return app;
}

/**
 * Starts the HTTP server.
 * @returns {void}
 */
function start() {
  const app = createApp();
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

  app.listen(PORT, () => {
    // Minimal startup log.
    console.log(`Backend listening on port ${PORT}`);
  });
}

start();

module.exports = { createApp };