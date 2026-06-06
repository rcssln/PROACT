# PROACT System - Docker Deployment Guide

This guide explains how to set up and run the PROACT Report System using Docker for local development or staging environments.

## 1. Prerequisites
*   **Docker Desktop** (Windows/Mac) or **Docker Engine** (Linux).
*   **Docker Compose** (included with Desktop, separate install for Linux).
*   A PostgreSQL database running on your host machine (Port `5434` by default).

## 2. Environment Configuration
The system requires two `.env` files that are typically not committed to the repository for security reasons.

### A. Backend Configuration
Create a file at `backend/.env`:
```env
PORT=4000
DB_HOST=host.docker.internal
DB_PORT=5434
DB_NAME=proact
DB_USER=proact_user
DB_PASSWORD=proact_secret
JWT_SECRET=your_jwt_secret_key
VITE_API_URL=http://localhost:4000/api
```
> **Note for Linux Users:** If you are on Linux, `host.docker.internal` might not work by default. Change `DB_HOST` to your local IP address (e.g., `192.168.1.x`) or add `extra_hosts` to the `docker-compose.yml`.

### B. Frontend Configuration
Create a file in the root directory named `.env`:
```env
VITE_API_URL=http://localhost:4000/api
```

## 3. Building and Running

### First Time Setup / Code Changes
Whenever you pull new code or change `.env` files, run a clean build:
```bash
docker-compose build --build-arg VITE_API_URL=http://localhost:4000/api
```

### Start the System
Run the containers in the background:
```bash
docker-compose up -d
```

### Check Status
Verify that both containers are "Running":
```bash
docker-compose ps
```

## 4. Accessing the System
Once the containers are up:
*   **Frontend (Website):** [http://localhost:4001](http://localhost:4001)
*   **Backend (API):** [http://localhost:4000/api](http://localhost:4000/api)

## 5. Useful Commands

| Action | Command |
| :--- | :--- |
| **View Backend Logs** | `docker logs proact_backend --tail 50 -f` |
| **Stop System** | `docker-compose down` |
| **Restart Backend** | `docker restart proact_backend` |
| **Rebuild after changes** | `docker-compose up -d --build` |

## 6. Common Troubleshooting

### "Connection Refused" to Database
If the backend logs show a database error:
1.  Ensure your local PostgreSQL is running.
2.  Ensure it is listening on Port `5434` (or update `.env`).
3.  **Windows/Mac:** Ensure `DB_HOST=host.docker.internal`.
4.  **Linux:** Add `network_mode: "host"` to the backend service in `docker-compose.yml` or use your machine's actual LAN IP.

### Login Fails / Empty Data
1.  Check the **F12 Network Tab** in your browser.
2.  Ensure the request URL is `http://localhost:4000/api/...`.
3.  If it says `https://proact.dost1.ph/api`, you forgot to pass the `--build-arg` during the build step. Run:
    `docker-compose build --build-arg VITE_API_URL=http://localhost:4000/api`

### Port 4000 or 4001 already in use
Change the port mapping in `docker-compose.yml`:
```yaml
ports:
  - "5000:4000"  # Change the first number to an available port
```
