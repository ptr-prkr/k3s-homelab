
const express = require("express");

const { websites } = require("../config/websites.json");

const {
  getLatestChecks,
  getHistory,
  saveCheck
} = require("../shared/database");

const { timingSafeEqual } = require("node:crypto");

const app = express();
app.use(express.json({ limit: "32kb" }));
const PORT = process.env.PORT || 3000;

// Kubernetes health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "uptimeops-api",
    timestamp: new Date().toISOString()
  });
});

// Get latest saved monitoring results
app.get("/api/status", (req, res) => {
  try {
    const results = getLatestChecks();

    res.json({
      application: "UptimeOps",
      totalWebsites: websites.length,
      summary: {
        up: results.filter(r => r.status === "UP").length,
        down: results.filter(r => r.status === "DOWN").length,
        restricted: results.filter(
          r => r.status === "RESTRICTED"
        ).length
      },
      results
    });

  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      error: "Unable to retrieve monitoring results"
    });
  }
});

// Retrieve historical checks for a website
app.get("/api/history", (req, res) => {
  const url = req.query.url;

  if (!url || !websites.includes(url)) {
    return res.status(400).json({
      error: "A valid monitored website URL is required"
    });
  }

  try {
    const requestedLimit = Number(req.query.limit ?? 100);

    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 500
    ) {
      return res.status(400).json({
        error: "Limit must be an integer between 1 and 500"
      });
    }

    const history = getHistory(url, requestedLimit);

    res.json({
      url,
      count: history.length,
      history
    });

  } catch (error) {
    console.error("History error:", error);

    res.status(500).json({
      error: "Unable to retrieve monitoring history"
    });
  }
});

// Start API server

app.post("/api/checks", (req, res) => {
  const token = process.env.WORKER_API_TOKEN;
  const supplied = req.get("X-Worker-Token") || "";

  if (!token) return res.sendStatus(503);

  const a = Buffer.from(token);
  const b = Buffer.from(supplied);

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.sendStatus(401);
  }

  const { url, status, httpStatus, responseTime, checkedAt } = req.body || {};

  if (
    !websites.includes(url) ||
    !["UP", "DOWN", "RESTRICTED"].includes(status) ||
    !(httpStatus === null ||
      (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599)) ||
    !Number.isInteger(responseTime) ||
    responseTime < 0 ||
    typeof checkedAt !== "string" ||
    !Number.isFinite(Date.parse(checkedAt))
  ) {
    return res.sendStatus(400);
  }

  try {
    saveCheck({ url, status, httpStatus, responseTime, checkedAt });
    res.status(201).json({ saved: true });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`UptimeOps API running on port ${PORT}`);
  console.log(`Configured websites: ${websites.length}`);
  console.log("SQLite monitoring history enabled");
});
