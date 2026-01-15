# 🌐 How to Add Your Custom Domain

## 1. Configure the Frontend
I have already centralized the configuration for you! 

1.  Open `client-react/src/config.js`
2.  Change the `API_URL` to your production backend URL:
    ```javascript
    // client-react/src/config.js
    export const API_URL = 'https://api.yourdomain.com'; // or 'https://yourdomain.com/api'
    ```

## 2. Deploying Your App
To use a real domain name, you need to host your application on a cloud provider.

### Option A: Hosting on VPS (DigitalOcean, AWS, Linode) - Recommended
This allows you to run both Backend (Java) and Frontend (React) on one server.

1.  **Buy a VPS (Virtual Private Server)** (Ubuntu 22.04 recommended).
2.  **Point your Domain** to the VPS IP address in your DNS settings (e.g., GoDaddy, Namecheap).
    *   `A Record`: `@` -> `192.168.x.x` (Your VPS IP)
    *   `A Record`: `api` -> `192.168.x.x` (For backend)
3.  **Install Software** on VPS:
    ```bash
    sudo apt update
    sudo apt install openjdk-21-jdk nginx
    sudo apt install npm
    ```
4.  **Run Backend:**
    *   Copy `server-spring` folder to VPS.
    *   Run with: `mvn spring-boot:run` (Use `nohup` or `Use Systemd` for background service).
5.  **Build React App:**
    *   Locally run: `npm run build` in `client-react`.
    *   Copy the `build` folder to the VPS (e.g., `/var/www/html`).
6.  **Configure Nginx (Reverse Proxy):**
    *   Route `/` to the React files.
    *   Route `/api` or specific port `8080` to your Java Backend.

### Option B: Separate Hosting (Easier)
1.  **Backend:** Deploy the Spring Boot JAR to **Render**, **Railway**, or **Heroku**.
    *   They will give you a URL like `https://my-chat-app.onrender.com`.
    *   Update your `config.js` with this URL.
2.  **Frontend:** Deploy React to **Vercel** or **Netlify**.
    *   Connect your GitHub repo.
    *   Add your custom domain in Vercel/Netlify settings.

## 3. SSL (HTTPS) - Important!
If you use a custom domain, you MUST use HTTPS.
*   **VPS:** Use `certbot` (Let's Encrypt) to get free SSL certificates.
*   **Vercel/Render:** They handle SSL automatically for you.

## Summary
✅ **Code is ready:** Just update `src/config.js`.
✅ **Next Step:** Choose a hosting provider and deploy!
