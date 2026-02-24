const fs = require('fs');
const path = require('path');
const os = require('os');

const interfaces = os.networkInterfaces();

// Try to find the Wi-Fi adapter IP first
let localIP = null;

// On Windows, Wi-Fi adapter often contains 'Wi-Fi' or 'Wireless' in name
for (const name of Object.keys(interfaces)) {
  if (!/wi[-]?fi|wireless/i.test(name)) continue; // skip non-Wi-Fi adapters

  for (const iface of interfaces[name]) {
    if (iface.family === 'IPv4' && !iface.internal) {
      localIP = iface.address;
      break;
    }
  }
  if (localIP) break;
}

// Fallback: if no Wi-Fi IP, pick first non-internal IPv4
if (!localIP) {
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIP = iface.address;
        break;
      }
    }
    if (localIP) break;
  }
}

if (!localIP) {
  console.error('❌ Could not detect Wi-Fi IP.');
  process.exit(1);
}

// Path to .env file
const envPath = path.join(__dirname, '.env');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Update or add EXPO_PUBLIC_API_URL
const regex = /^EXPO_PUBLIC_API_URL=.*$/m;
const newLine = `EXPO_PUBLIC_API_URL=http://${localIP}:8000/api`;

if (regex.test(envContent)) {
  envContent = envContent.replace(regex, newLine);
} else {
  envContent += `\n${newLine}\n`;
}

// Write back to .env
fs.writeFileSync(envPath, envContent, 'utf8');

console.log(`✅ Updated .env with EXPO_PUBLIC_API_URL=${newLine}`);
