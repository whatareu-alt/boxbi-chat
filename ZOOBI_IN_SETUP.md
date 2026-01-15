# 🚀 Deployment Guide for zoobi.in

Since your domain is **zoobi.in**, here is your specific setup plan.

## 1. DNS Configuration (Where you bought the domain)

Go to your domain registrar (GoDaddy, Namecheap, etc.) and add these records:

| Type | Name (Host) | Value (Points to) | Purpose |
|------|-------------|-------------------|---------|
| **A** | `@` | `YOUR_SERVER_IP` | Points `zoobi.in` to your frontend |
| **A** | `api` | `YOUR_SERVER_IP` | Points `api.zoobi.in` to your backend |

*(Replace `YOUR_SERVER_IP` with the IP address of the VPS you buy)*

## 2. Server Setup (VPS)

When you buy a server (e.g., from DigitalOcean), follow these steps:

### A. Run the Backend (Spring Boot) on port 8080
1. Upload your `server-spring` folder.
2. Run it:
   ```bash
   ./mvnw spring-boot:run
   ```

### B. Configure Nginx (The Web Server)
Install Nginx (`sudo apt install nginx`) and edit the config:

```nginx
# Frontend - zoobi.in
server {
    server_name zoobi.in www.zoobi.in;
    
    location / {
        # Point this to your React build folder
        root /var/www/zoobi-client/build;
        try_files $uri /index.html;
    }
}

# Backend - api.zoobi.in
server {
    server_name api.zoobi.in;

    location / {
        proxy_pass http://localhost:8080; # Forwards to Spring Boot
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 3. Go Live!

1. Open `client-react/src/config.js` on your computer.
2. Change line 6 to: `const IS_PRODUCTION = true;`
3. Run `npm run build` inside `client-react`.
4. Upload the `build` folder to your server.

**🎉 Your chat app will be live at: https://zoobi.in**
