# Panduan Setup: Hermes di VPS (Host OS) + Hermes3D di Kubernetes (Pod via Traefik)

Panduan ini mengatur arsitektur terpisah:
1. **Hermes Agent** berjalan langsung di **Host OS VPS** (punya akses penuh ke OS, disk `~/.hermes`, cron, tools, dan 9Router).
2. **Hermes3D (Frontend 3D)** berjalan sebagai **Pod di Cluster Kubernetes** di bawah Ingress **Traefik**.

---

## Arsitektur

```text
[ Browser / Internet ]
         │ (HTTPS / WSS port 443)
         ▼
[ Traefik Ingress (K8s Cluster) ]
         │
         ▼
[ Pod hermes3d-ui (K8s) ]
         │ (WebSocket keluar cluster)
         ▼
[ Host VPS: port 9119 ] ──▶ [ Hermes Agent (hermes serve via PM2) ]
                                      │
                                      ▼
                                 [ 9Router ]
```

---

## Bagian 1: Setup di VPS (Host OS)

Hermes Agent berjalan di host VPS menggunakan PM2 agar stabil dan auto-restart.

### 1. Jalankan Hermes Serve di 0.0.0.0
Agar pod Kubernetes bisa menghubungi Hermes di port 9119, Hermes Agent harus listen di `0.0.0.0` (bukan hanya localhost).

Buat file `/etc/systemd/system/hermes-agent.service` atau gunakan **PM2**.

**Jika Menggunakan PM2 di VPS:**
Buat file `~/ecosystem.hermes.js`:

```javascript
module.exports = {
  apps: [
    {
      name: "hermes-agent",
      script: "hermes",
      args: "serve --host 0.0.0.0 --port 9119 --skip-build",
      env: {
        HERMES_DASHBOARD_SESSION_TOKEN: "GANTI_TOKEN_GATEWAY_RAHASIA",
      },
      autorestart: true,
      restart_delay: 4000,
    },
  ],
};
```

Jalankan:
```bash
pm2 start ~/ecosystem.hermes.js
pm2 save
pm2 startup
```

### 2. Atur Firewall / Security Group VPS
**SANGAT PENTING (Keamanan):**
Jangan buka port `9119` ke publik umum (`0.0.0.0/0`).
Hanya izinkan port `9119` dari:
- **IP Node Kubernetes** (IP keluar Pod / NAT gateway cluster).
- Atau jika VPS dan K8s berada di satu jaringan private/VPC, gunakan IP Private VPS.

Contoh UFW di VPS:
```bash
sudo ufw allow from <IP_CLUSTER_K8S> to any port 9119 proto tcp
```

---

## Bagian 2: Setup di Kubernetes (Hermes3D Pod)

### 1. Build & Push Image Docker Hermes3D
Dari laptop kamu (atau CI/CD), build Docker image dengan perubahan bridge terbaru:

```bash
cd /Users/bae/Documents/GitHub/hermes-3d

# Build docker image
docker build -t ghcr.io/baihakitanjung/hermes-3d:latest .

# Push ke registry (GitHub Container Registry / Docker Hub)
docker push ghcr.io/baihakitanjung/hermes-3d:latest
```

### 2. Manifest Kubernetes (`k8s-hermes3d.yaml`)

Terapkan manifest berikut di cluster K8s kamu:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hermes3d
---
apiVersion: v1
kind: Secret
metadata:
  name: hermes3d-secret
  namespace: hermes3d
type: Opaque
stringData:
  STUDIO_ACCESS_TOKEN: "ganti-token-login-ui-bebas"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hermes3d-ui
  namespace: hermes3d
  labels:
    app: hermes3d-ui
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hermes3d-ui
  template:
    metadata:
      labels:
        app: hermes3d-ui
    spec:
      containers:
        - name: hermes3d
          image: ghcr.io/baihakitanjung/hermes-3d:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
              name: http
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3000"
            - name: HOST
              value: "0.0.0.0"
            - name: STUDIO_ACCESS_TOKEN
              valueFrom:
                secretKeyRef:
                  name: hermes3d-secret
                  key: STUDIO_ACCESS_TOKEN
            # Arahkan ke IP VPS tempat Hermes Agent berjalan
            - name: HERMES3D_GATEWAY_URL
              value: "ws://103.77.78.114:9119"
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: hermes3d-service
  namespace: hermes3d
spec:
  selector:
    app: hermes3d-ui
  ports:
    - name: http
      port: 3000
      targetPort: 3000
---
# Ingress Traefik (CRD IngressRoute)
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: hermes3d-ingress
  namespace: hermes3d
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`hermes.domainkamu.com`)
      kind: Rule
      services:
        - name: hermes3d-service
          port: 3000
  tls:
    secretName: hermes3d-cert-secret
```

Terapkan ke cluster:
```bash
kubectl apply -f k8s-hermes3d.yaml
```

---

## Bagian 3: Verifikasi

1. **Cek Pod Hermes3D di K8s**:
   ```bash
   kubectl get pods -n hermes3d
   kubectl logs -n hermes3d deploy/hermes3d-ui -f
   ```
   Pastikan log menampilkan:
   ```text
   [gateway-proxy] transport: embedded hermes-agent bridge (JSON-RPC translation)
   ```

2. **Cek Akses Web**:
   - Buka `https://hermes.domainkamu.com`
   - Masukkan `STUDIO_ACCESS_TOKEN` saat diminta.
   - Status pojok kanan atas berwarna hijau (`Connected`).
   - Meja agen, kanban, dan tools langsung tersinkron dari host VPS.
