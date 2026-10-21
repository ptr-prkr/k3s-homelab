# UptimeOps — Kubernetes Website Monitoring Homelab

A full-stack website monitoring application built with **React, TypeScript, Node.js and SQLite**, containerised using Docker and deployed to a single-node **Kubernetes (k3s) homelab** running Ubuntu Server.

UptimeOps automatically checks website availability every 60 seconds, records HTTP status codes and response times, stores historical results, and presents monitoring data through a modern web dashboard.

## Dashboard

![UptimeOps Monitoring Dashboard](screenshots/01-dashboard.png)

## Architecture

The application uses three independently deployed Kubernetes workloads:

**Frontend → Backend → Database**

**Monitoring Worker → Backend → Database**

Incoming requests are routed through Traefik Ingress to the React frontend, served by Nginx. Nginx proxies API requests to the Express backend through an internal Kubernetes Service.

The monitoring worker periodically checks external websites and submits results to the backend through an authenticated REST API.

SQLite stores monitoring results on a persistent Kubernetes volume.

### Architecture Components

| Component | Responsibility |
|---|---|
| Traefik Ingress | Routes local-network HTTP traffic to the frontend |
| React + Nginx | Displays website availability and response times |
| Express API | Provides monitoring status, history and authenticated submissions |
| Monitoring Worker | Checks five websites every 60 seconds |
| SQLite | Stores monitoring history |
| Kubernetes PVC | Preserves database files across Pod restarts |
| Kubernetes Secret | Supplies the worker authentication token |

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js 24, Express |
| Database | SQLite |
| Web Server | Nginx |
| Monitoring | Node.js Fetch API |
| Containerisation | Docker |
| Orchestration | Kubernetes (k3s) |
| Networking | Traefik Ingress, ClusterIP Services |
| Storage | Kubernetes PersistentVolumeClaim, local-path |
| Security | Kubernetes Secrets, API token authentication |
| Infrastructure | Ubuntu Server 24.04 LTS |

## Features

- Automated website monitoring every 60 seconds
- HTTP availability and response-time measurements
- UP, DOWN and RESTRICTED status classification
- React monitoring dashboard
- REST API for latest monitoring results and historical checks
- Persistent SQLite database
- Authenticated worker-to-backend communication
- Three independent Docker containers
- Kubernetes Deployments and Services
- Persistent storage through a 1 GiB PVC
- Kubernetes backend readiness probe
- Local-network access through Traefik Ingress

## Kubernetes Deployment

![Kubernetes Resources](screenshots/02-kubernetes-resources.png)

The application is deployed in the `uptimeops` namespace.

| Kubernetes Resource | Configuration |
|---|---|
| Deployments | 3 — frontend, backend, worker |
| Services | 2 — frontend and backend |
| PersistentVolumeClaim | 1 GiB, ReadWriteOnce |
| Secret | Worker API authentication |
| Ingress | Traefik, HTTP port 80 |
| Worker replicas | 1 |
| Backend replicas | 1 |
| Frontend replicas | 1 |

All three application Pods were verified running with zero restarts during deployment testing.

## Docker Containerisation

Each application component has its own Dockerfile.

**Backend image:** `uptimeops-api:local`

**Worker image:** `uptimeops-worker:local`

**Frontend image:** `uptimeops-frontend:local`

The frontend uses a multi-stage Docker build: Node.js compiles the React application, and Nginx serves the resulting static files.

The backend and worker use Node.js 24 Alpine-based images.

Images are built locally and imported into the k3s containerd runtime.

## Deployment Instructions

### 1. Build Docker Images

From the project root, run:

`docker build -f backend/Dockerfile -t uptimeops-api:local .`

`docker build -f worker/Dockerfile -t uptimeops-worker:local .`

`docker build -f frontend/Dockerfile -t uptimeops-frontend:local .`

### 2. Import Images into k3s

Export the three images:

`docker save uptimeops-api:local uptimeops-worker:local uptimeops-frontend:local -o /tmp/uptimeops-images.tar`

Import them into containerd:

`sudo k3s ctr -n k8s.io images import /tmp/uptimeops-images.tar`

### 3. Create Kubernetes Namespace

`kubectl create namespace uptimeops`

### 4. Create Worker Authentication Secret

Generate a secure token and create the Kubernetes Secret:

`kubectl -n uptimeops create secret generic uptimeops-worker-token --from-literal="token=$(openssl rand -hex 32)"`

The same Secret is supplied to the backend and worker through environment variables.

### 5. Deploy the Application

`kubectl apply -f k8s/uptimeops.yaml`

`kubectl apply -f k8s/ingress.yaml`

### 6. Verify Kubernetes Resources

`kubectl -n uptimeops get pods,svc,pvc,ingress`

Check worker logs:

`kubectl -n uptimeops logs deployment/uptimeops-worker --tail=20`

The dashboard is accessible through the homelab server's local-network IP address on HTTP port 80.

## Monitoring Worker

![UptimeOps Monitoring Worker](screenshots/03-worker-logs.png)

The worker performs availability checks every 60 seconds.

Each monitoring result includes:

- Website URL
- Availability status
- HTTP status code
- Response time in milliseconds
- Timestamp

The worker sends results to the Express API using the `X-Worker-Token` authentication header.

Successful monitoring cycles were verified with **5/5 results saved via API**.

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Backend health check |
| GET | `/api/status` | Latest monitoring results |
| GET | `/api/history?url=...` | Historical website checks |
| POST | `/api/checks` | Authenticated monitoring submissions |

## Database and Persistent Storage

UptimeOps uses SQLite for monitoring history.

The backend mounts a Kubernetes PersistentVolumeClaim at `/data`, with the database stored at `/data/uptimeops.db`.

SQLite uses Write-Ahead Logging (WAL) to support reliable database operations.

The persistent volume preserves monitoring history across container and Pod restarts.

Because this is a single-node homelab using local storage, it does not provide high availability or off-node disaster recovery.

## Project Structure

| Directory | Contents |
|---|---|
| `backend/` | Express API and backend Dockerfile |
| `worker/` | Monitoring worker and Dockerfile |
| `frontend/` | React application, Nginx configuration and Dockerfile |
| `shared/` | SQLite database operations |
| `config/` | Website monitoring configuration |
| `k8s/` | Kubernetes Deployments, Services, PVC and Ingress |
| `screenshots/` | Dashboard and deployment evidence |

## Security

The application includes several security measures:

- Token authentication for monitoring submissions
- Kubernetes Secret for credential distribution
- Internal ClusterIP Services for application communication
- SQLite database isolated from direct network access
- Git exclusions for local database files, credentials and environment variables

**Security limitation:** The current dashboard uses unauthenticated HTTP and is designed for a trusted home network. Public deployment would require HTTPS, access controls and additional security hardening.

## Troubleshooting and Lessons Learned

This project provided practical experience in:

- Building and integrating a full-stack application
- Separating the frontend, backend and monitoring worker
- Containerising applications with Docker
- Importing locally built images into Kubernetes containerd
- Configuring Kubernetes Deployments, Services and Secrets
- Provisioning persistent storage with local-path
- Configuring Traefik Ingress
- Troubleshooting HTTP 401 authentication failures
- Debugging application networking and monitoring worker communication
- Inspecting Kubernetes Pods, logs and resource health

A notable challenge involved HTTP 401 errors between the Kubernetes worker and backend. Regenerating the Kubernetes authentication Secret and restarting both deployments resolved the issue.

## Future Improvements

- HTTPS and dashboard authentication
- Email or webhook downtime alerts
- Historical response-time charts
- Prometheus and Grafana integration
- Automated CI/CD pipelines
- Container registry integration
- Automated SQLite backups
- Multi-node Kubernetes deployment
- High availability and disaster recovery

## Author

**Peter Parker**

Cloud Infrastructure | DevOps | Software Engineering

Built as part of a hands-on DevOps engineering portfolio.