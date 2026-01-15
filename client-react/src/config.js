// ---------------------------------------------------------------------------
// 🔧 CONFIGURATION FOR ZOOBI.IN
// ---------------------------------------------------------------------------

// Set this to TRUE when you are ready to deploy to zoobi.in
// Set this to FALSE when you are testing on your computer (localhost)
const IS_PRODUCTION = true;

export const API_URL = IS_PRODUCTION
    ? 'https://api.zoobi.in'      // Your Production Backend
    : 'http://localhost:8080';    // Your Local Backend
