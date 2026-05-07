# Docker and Kubernetes Deployment Guide

This document outlines the architecture and step-by-step instructions to deploy the BobTheBuilder platform to a Kubernetes cluster.

## 1. The Kubernetes Manifests Explained

The `k8s/` directory contains sequentially numbered YAML files. Kubernetes applies them in alphabetical order to ensure dependencies (like Namespaces and Configs) exist before the apps that need them.

- **`01-namespace.yaml`**: Creates the `btb-production` Namespace. This is a logical boundary that isolates all our resources from other apps on the cluster.
- **`02-config.yaml`**: Creates the ConfigMap (`btb-config`) and a Secret (`btb-secrets`). This securely provides non-sensitive environment variables (like `NODE_ENV`) and the database URL to our pods.
- **`03-postgres.yaml`**: Deploys the PostgreSQL database container and creates an internal Service (`btb-postgres-service`) so other pods can talk to it.
- **`04-llm.yaml`**: Deploys the Python FastAPI LLM service. It includes:
  - **Deployment**: Runs the containers.
  - **Health Probes**: Kubernetes automatically checks `/health` to know if the pod is alive or frozen.
  - **HPA (Autoscaler)**: Automatically scales the number of pods from 2 up to 5 if CPU usage spikes.
- **`05-backend.yaml`**: Deploys the Node.js API with 3 baseline replicas, TCP health checks, and its own Autoscaler.
- **`06-frontend.yaml`**: Deploys the Nginx web server containing the compiled React application. It includes a custom `nginx.conf` that supports React Router's SPA routing.
- **`07-ingress.yaml`**: The cluster's "front door". It intercepts all traffic and routes requests starting with `/api` to the backend, and everything else to the frontend.
- **`08-ngrok.yaml`**: Optional public demo tunnel. It runs ngrok inside the cluster and forwards public HTTPS traffic to `btb-frontend-service:80`.

---

## 2. How to Properly Run and Deploy Locally

Follow these steps in order to build, configure, and run the complete architecture on your local machine (using Docker Desktop or Minikube).

### Step 1: Build the Docker Images
Because the project is a Monorepo, the Node.js Dockerfiles must be built from the root directory.

```bash
docker build -t your-registry/btb-frontend:v1 -f apps/frontend/Dockerfile .
docker build -t your-registry/btb-backend:v1 -f apps/backend/Dockerfile .
docker build -t your-registry/btb-llm:v1 ./apps/backend/services/llm
```

### Step 2: Apply the Core Manifests
Tell Kubernetes to spin up the core app architecture:

```bash
kubectl apply -f k8s/01-namespace.yaml
kubectl apply -f k8s/02-config.yaml
kubectl apply -f k8s/03-postgres.yaml
kubectl apply -f k8s/04-llm.yaml
kubectl apply -f k8s/05-backend.yaml
kubectl apply -f k8s/06-frontend.yaml
kubectl apply -f k8s/07-ingress.yaml
```

### Step 3: Inject the Sensitive API Keys
We removed API keys from the YAML files so they don't leak into Git. Instead, we generate a Kubernetes Secret directly from your local `.env` file.

Run this to inject your Gemini keys securely into the cluster:
```bash
kubectl create secret generic llm-secrets --from-env-file=apps/backend/services/llm/.env -n btb-production
```
*(If the LLM pods were already running, restart them to pick up the new secret: `kubectl rollout restart deployment btb-llm -n btb-production`)*

### Step 4: Run the Database Migrations
When you deploy to a fresh cluster, the PostgreSQL database is completely empty. If you try to save a dashboard, the backend will crash with a 500 error.

We must run the migration scripts inside the cluster to create the tables:
```bash
kubectl exec deployment/btb-backend -n btb-production -- npm run migrate
```

---

## 3. Accessing the Application

If you do not have an Ingress Controller (like Nginx Ingress) fully configured with a domain name on your local cluster, you can access the frontend directly via Port-Forwarding.

### Port-Forward the Frontend
Open a terminal tab and run:
```bash
kubectl port-forward svc/btb-frontend-service 8080:80 -n btb-production
```
You can now view the UI at `http://localhost:8080`.

The frontend Nginx config proxies `/api` to `btb-backend-service:3001` inside Kubernetes, so a second backend port-forward is not required.

---

## 4. Public Demo Access with ngrok

Use this when you want other people to access your local Kubernetes deployment over a temporary public HTTPS URL.

### Step 1: Get an ngrok Authtoken
Create or sign in to an ngrok account, then copy your authtoken from the ngrok dashboard.

### Step 2: Create the Kubernetes Secret
Replace `<YOUR_NGROK_AUTHTOKEN>` with your token:

```bash
kubectl create secret generic ngrok-secrets --from-literal=NGROK_AUTHTOKEN=<YOUR_NGROK_AUTHTOKEN> -n btb-production
```

If you already created it and need to replace it:

```bash
kubectl delete secret ngrok-secrets -n btb-production
kubectl create secret generic ngrok-secrets --from-literal=NGROK_AUTHTOKEN=<YOUR_NGROK_AUTHTOKEN> -n btb-production
```

### Step 3: Deploy the Tunnel

```bash
kubectl apply -f k8s/08-ngrok.yaml
```

### Step 4: Read the Public URL

```bash
kubectl logs deployment/btb-ngrok -n btb-production
```

Look for the `url=https://...ngrok-free.app` line. Share that HTTPS URL with others.

### Step 5: Stop Public Sharing

```bash
kubectl delete -f k8s/08-ngrok.yaml
```

---

## 5. Helpful Commands

**Watch pods spin up or check for crashes:**
```bash
kubectl get pods -n btb-production -w
```

**Check the logs of a crashing backend pod:**
```bash
kubectl logs deployment/btb-backend -n btb-production
```

**Restart a deployment after making code changes:**
```bash
kubectl rollout restart deployment btb-frontend -n btb-production
```

**Check the ngrok tunnel logs:**
```bash
kubectl logs deployment/btb-ngrok -n btb-production
```
