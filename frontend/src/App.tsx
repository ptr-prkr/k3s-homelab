
import { useEffect, useState } from 'react'
import './App.css'

type WebsiteStatus = 'UP' | 'DOWN' | 'RESTRICTED'

interface WebsiteResult {
  url: string
  status: WebsiteStatus
  httpStatus: number | null
  responseTime: number
  checkedAt: string
}

interface StatusResponse {
  application: string
  totalWebsites: number
  summary: {
    up: number
    down: number
    restricted: number
  }
  results: WebsiteResult[]
}

function App() {
  const [data, setData] = useState<StatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadStatus() {
    try {
      const response = await fetch('/api/status')

      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`)
      }

      const result: StatusResponse = await response.json()
      setData(result)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load status'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatus()

    const interval = setInterval(() => {
      void loadStatus()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const averageResponse = data?.results.length
    ? Math.round(
        data.results.reduce(
          (sum, website) => sum + website.responseTime,
          0
        ) / data.results.length
      )
    : 0

  return (
    <main className="dashboard">
      <header className="header">
        <div>
          <p className="eyebrow">INFRASTRUCTURE MONITORING</p>
          <h1>UptimeOps</h1>
          <p className="subtitle">
            Real-time website availability and performance
          </p>
        </div>

        <div className="header-actions">
          <span className="refresh-label">
            Auto-refresh: 30s
          </span>
          <button onClick={() => void loadStatus()}>
            Refresh now
          </button>
        </div>
      </header>

      {error && (
        <div className="error">
          Unable to refresh monitoring data: {error}
        </div>
      )}

      {loading && <p>Loading monitoring results...</p>}

      {data && (
        <>
          <section className="stats">
            <div className="stat-card">
              <span>Monitored websites</span>
              <strong>{data.totalWebsites}</strong>
            </div>

            <div className="stat-card">
              <span>Operational</span>
              <strong className="green">{data.summary.up}</strong>
            </div>

            <div className="stat-card">
              <span>Down</span>
              <strong className="red">{data.summary.down}</strong>
            </div>

            <div className="stat-card">
              <span>Average response</span>
              <strong>{averageResponse} ms</strong>
            </div>
          </section>

          <section className="monitoring-section">
            <div className="section-heading">
              <div>
                <h2>Website monitoring</h2>
                <p>Latest results from the monitoring worker</p>
              </div>
              <span className="website-count">
                {data.results.length} websites
              </span>
            </div>

            <div className="website-list">
              {data.results.map(website => (
                <div className="website-card" key={website.url}>
                  <div className="website-info">
                    <h3>{new URL(website.url).hostname}</h3>
                    <a
                      href={website.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {website.url}
                    </a>
                    <p>
                      Last checked:{' '}
                      {new Date(website.checkedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="website-metrics">
                    <div>
                      <span>HTTP</span>
                      <strong>{website.httpStatus ?? 'N/A'}</strong>
                    </div>
                    <div>
                      <span>Response</span>
                      <strong>{website.responseTime} ms</strong>
                    </div>
                    <span
                      className={`status-badge ${website.status.toLowerCase()}`}
                    >
                      {website.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer>
            UptimeOps · React + TypeScript · Express · SQLite · k3s
          </footer>
        </>
      )}
    </main>
  )
}

export default App
