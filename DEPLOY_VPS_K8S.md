# Panduan Setup: Hermes di VPS (Host OS) + Hermes3D di Kubernetes (Pod via Traefik)

Panduan ini mengatur arsitektur terpisah:
1. **Hermes Agent** berjalan langsung di **Host OS VPS** via PM2 (punya akses penuh ke OS, disk `~/.hermes`, cron, tools, dan 9Router).
2. **Hermes3D (Frontend 3D)** berjalan sebagai **Pod di Cluster Kubernetes** di namespace `hermes-3d` di bawah Ingress **Traefik**.

---

## 1. Peta Port & Aturan Firewall VPS

| Komponen | Port | Bind / Listen | Diekspos ke Publik? | Keterangan |
|---|---|---|---|---|
| **Traefik (K8s Ingress)** | **`443`** (HTTPS) / `80` (HTTP) | `0.0.0.0` (IP Publik VPS) | **YA (Satu-satunya)** | Entry point publik user (`https://hermes.domainkamu.com`) |
| **Pod `hermes3d-ui`** | `3000` | In-Cluster Pod IP | **TIDAK** | Hanya diakses internal oleh Traefik via Service K8s |
| **Host `hermes serve`** | `9119` | `0.0.0.0` (Internal VPS) | **TIDAK (Wajib diblock)** | Hanya diakses oleh Pod K8s via internal `status.hostIP:9119` |

### Konfigurasi Firewall di VPS (UFW):
```bash
# 1. Buka akses publik HANYA untuk Traefik web traffic
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 2. Buka port 9119 HANYA untuk subnet Pod K8s (misal K3s/RKE2: 10.42.0.0/16 atau flannel)
# Ganti 10.42.0.0/16 dengan Pod CIDR cluster kamu
sudo ufw allow from 10.42.0.0/16 to any port 9119 proto tcp
```

---

## 2. Arsitektur Komunikasi

```text
[ Browser / Internet ]
         │ (HTTPS / WSS port 443)
         ▼
[ Traefik Ingress (K8s Cluster) ]
         │ (ClusterIP internal port 3000)
         ▼
[ Pod hermes3d-ui (Namespace: hermes-3d) ]
         │
         │ (WebSocket via status.hostIP:9119 - CNI Gateway internal, no hairpin NAT)
         ▼
[ Host VPS: port 9119 ] ──▶ [ Hermes Agent (hermes serve via PM2) ]
                                      │
                                      ▼
                                 [ 9Router ]
```

---

## 3. Setup di Host VPS (Hermes Agent)

Hermes Agent berjalan di host VPS menggunakan PM2 agar stabil dan auto-restart tanpa intervensi manual.

### Konfigurasi Headless Auth & Host Bind
Agar `hermes serve` dapat menerima koneksi dari pod K8s tanpa stuck di prompt interaktif username/password:

Buat/update file ecosystem di VPS (misal `~/ecosystem.hermes.js` atau di folder project):
```javascript
module.exports = {
  apps: [
    {
      name: "hermes-agent",
      script: "hermes",
      args: "serve --host 0.0.0.0 --port 9119 --skip-build",
      env: {
        // Token session gateway untuk koneksi WebSocket dari pod Hermes3D (harus match secret K8s)
        HERMES_DASHBOARD_SESSION_TOKEN: "GANTI_TOKEN_GATEWAY_RAHASIA",
        // Wajib saat bind 0.0.0.0 agar hermes serve tidak stuck pada prompt interaktif auth
        HERMES_DASHBOARD_USERNAME: "admin",
        HERMES_DASHBOARD_PASSWORD: "GANTI_PASSWORD_DASHBOARD_RAHASIA",
      },
      autorestart: true,
      restart_delay: 4000,
    },
  ],
};
```

Jalankan via PM2:
```bash
pm2 start ~/ecosystem.hermes.js
pm2 save
pm2 startup
```

---

## 4. Persiapan Path Deployment di VPS untuk CI/CD

GitHub Actions workflow menjalankan SSH script yang membaca manifest dari folder home:
```bash
# Di VPS (user rlordz12):
mkdir -p /home/rlordz12/hermes-3d
cp k8s-hermes3d.yaml /home/rlordz12/hermes-3d/k8s-hermes3d.yaml
```

---

## 5. Manifest Kubernetes (`k8s-hermes3d.yaml`)

Manifest ini berada di namespace `hermes-3d` dan menggunakan `status.hostIP` agar pod otomatis menemukan IP internal node/host VPS tanpa terbentur masalah Hairpin NAT IP publik:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hermes-3d
---
apiVersion: v1
kind: Secret
metadata:
  name: hermes3d-secret
  namespace: hermes-3d
type: Opaque
stringData:
  # Token login saat user pertama kali membuka web UI
  STUDIO_ACCESS_TOKEN: "ganti-token-login-ui-bebas"
  # Token auth ke gateway hermes serve di port 9119 host (harus sama dengan HERMES_DASHBOARD_SESSION_TOKEN di VPS)
  HERMES_GATEWAY_TOKEN: "GANTI_TOKEN_GATEWAY_RAHASIA"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hermes3d-ui
  namespace: hermes-3d
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
      automountServiceAccountToken: false
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
            - name: HERMES3D_GATEWAY_TOKEN
              valueFrom:
                secretKeyRef:
                  name: hermes3d-secret
                  key: HERMES_GATEWAY_TOKEN
            - name: HERMES3D_ADAPTER_TYPE
              value: "hermes-agent"
            # Downward API: mengambil IP internal node host
            - name: HOST_IP
              valueFrom:
                fieldRef:
                  fieldPath: status.hostIP
            # K8s env expansion langsung ke internal host gateway
            - name: HERMES3D_GATEWAY_URL
              value: "ws://$(HOST_IP):9119"
          resources:
            requests:
              cpu: "200m"
              memory: "384Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: false
            capabilities:
              drop: ["ALL"]
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: hermes3d-service
  namespace: hermes-3d
spec:
  selector:
    app: hermes3d-ui
  ports:
    - name: http
      port: 3000
      targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hermes3d-network-policy
  namespace: hermes-3d
spec:
  podSelector:
    matchLabels:
      app: hermes3d-ui
  policyTypes: ["Ingress", "Egress"]
  ingress:
    # Traffic HTTP dari Traefik Ingress
    - ports:
        - port: 3000
          protocol: TCP
  egress:
    # DNS
    - ports:
        - port: 53
          protocol: UDP
        - port: 53
          protocol: TCP
    # Akses ke port 9119 host node VPS
    - ports:
        - port: 9119
          protocol: TCP
    # Akses keluar untuk LLM router (port 443 & 80)
    - ports:
        - port: 443
          protocol: TCP
        - port: 80
          protocol: TCP
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: hermes3d-ingress
  namespace: hermes-3d
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

---

## 6. Verifikasi & Troubleshooting

1. **Cek status pod di namespace `hermes-3d`**:
   ```bash
   kubectl get pods -n hermes-3d
   kubectl logs -n hermes-3d deploy/hermes3d-ui -f
   ```
2. **Cek service Hermes di host VPS**:
   ```bash
   pm2 status
   pm2 logs hermes-agent
   ss -tulpn | grep 9119
   ```
3. **Buka di browser**:
   - Kunjungi `https://hermes.domainkamu.com`.
   - Masukkan `STUDIO_ACCESS_TOKEN`.
   - Status di pojok kanan atas hijau (`Connected`).
