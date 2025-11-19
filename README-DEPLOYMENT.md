# Deployment Guide - HTTPS Setup

## Prerequisites
- Domain `energenius-wallet.zentrix.io` pointing to your droplet IP (64.226.90.101)
- Docker and Docker Compose installed on the server

## Step-by-Step Deployment

### 1. Upload Files to Server
Upload the entire project directory to your server (or use git clone).

### 2. Build Nginx Image
```bash
cd /root
docker build -t energenius-nginx -f nginx/Dockerfile nginx/
```

### 3. Initialize SSL Certificate
```bash
# Make sure the script is executable
chmod +x init-letsencrypt.sh

# Run the initialization script
./init-letsencrypt.sh
```

This script will:
- Create dummy certificates to start nginx
- Request real Let's Encrypt certificates
- Configure nginx with SSL

### 4. Start All Services
```bash
docker compose up -d
```

### 5. Verify Everything is Running
```bash
docker compose ps
```

### 6. Test Your Setup
- Frontend: https://energenius-wallet.zentrix.io
- Backend API: https://energenius-wallet.zentrix.io/v1
- Swagger Docs: https://energenius-wallet.zentrix.io/v1/api-docs

## Certificate Renewal
The certbot container runs automatically and renews certificates every 12 hours. No manual intervention needed.

## Troubleshooting

### If certificate generation fails:
1. Make sure port 80 is open in your firewall
2. Verify DNS is pointing to your droplet
3. Check nginx logs: `docker compose logs nginx`
4. Check certbot logs: `docker compose logs certbot`

### To manually renew certificates:
```bash
docker compose run --rm certbot renew
docker compose exec nginx nginx -s reload
```


