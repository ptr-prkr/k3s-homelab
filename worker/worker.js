const { websites, intervalSeconds, timeoutSeconds } = require("../config/websites.json");

const API_URL = process.env.API_URL || "http://127.0.0.1:3000";
const TOKEN = process.env.WORKER_API_TOKEN;

async function checkWebsite(url) {
  const start = performance.now();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutSeconds * 1000),
      redirect: "follow"
    });

    const result = {
      url,
      status: response.status >= 200 && response.status < 400
        ? "UP"
        : [401, 403].includes(response.status)
          ? "RESTRICTED"
          : "DOWN",
      httpStatus: response.status,
      responseTime: Math.round(performance.now() - start),
      checkedAt: new Date().toISOString()
    };

    await response.body?.cancel();
    return result;
  } catch (error) {
    return {
      url,
      status: "DOWN",
      httpStatus: null,
      responseTime: Math.round(performance.now() - start),
      checkedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

async function runChecks() {
  const results = await Promise.all(websites.map(checkWebsite));
  let saved = 0;

  for (const result of results) {
    try {
      const response = await fetch(`${API_URL}/api/checks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Token": TOKEN
        },
        body: JSON.stringify(result),
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      saved++;
      console.log(`${result.status} | ${result.url} | Saved via API`);
    } catch (error) {
      console.error(`Save failed: ${result.url}: ${error.message}`);
    }
  }

  console.log(`Saved via API: ${saved}/${results.length}`);
}

async function start() {
  if (!TOKEN) throw new Error("WORKER_API_TOKEN missing");

  console.log("UptimeOps Worker - HTTP API persistence");

  while (true) {
    const started = Date.now();
    await runChecks().catch(console.error);
    await new Promise(resolve =>
      setTimeout(resolve, Math.max(0, intervalSeconds * 1000 - (Date.now() - started)))
    );
  }
}

start().catch(console.error);
