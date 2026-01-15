# 🚨 Fixing "Build Failed" & JAVA_HOME on Render

It seems Render is struggling to pick the right Java version or run the Maven wrapper. Here is the **definitive fix**.

## 1️⃣ Force Java 21 in Render

Render needs to know explicitly which Java version to use.

1. Go to **Render Dashboard** → **Environment** text.
2. Add this **Environment Variable**:

| Key | Value |
|-----|-------|
| `JAVA_VERSION` | `21` |

*(This ensures Render uses Java 21, which matches your `pom.xml`)*

## 2️⃣ Update Build Command (The "Safe" Way)

Since `./mvnw` is giving permission errors or `JAVA_HOME` errors, we will use the **Render-provided Maven**.

1. Go to **Settings** → **Build & Deploy**.
2. Change **Build Command** to:
   ```bash
   mvn clean package -DskipTests
   ```
   *(Note: plain `mvn`, NOT `./mvnw`)*

## 3️⃣ Check "Root Directory"

Make sure your **Root Directory** setting in Render is correct.
* It MUST be set to: `server-spring`
* If it is empty or `/`, the build will fail because it can't find `pom.xml`.

## 4️⃣ Verify All Environment Variables

Ensure these are all present in the **Environment** tab:

```text
JAVA_VERSION = 21
SERVER_PORT = 8080
SPRING_DATASOURCE_URL = jdbc:h2:file:./data/chat_db
JAVA_TOOL_OPTIONS = -Xmx512m
```

---

### 🔄 Summary of Fix Actions:
1. **Set `JAVA_VERSION` to `21`** in Environment variables.
2. **Set Build Command** to `mvn clean package -DskipTests`.
3. **Ensure Root Directory** is `server-spring`.

**Try deploying again after these changes!** 🚀
