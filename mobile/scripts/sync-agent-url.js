const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.AGENT_PORT || '8080';
const ENV_PATH = path.resolve(__dirname, '..', '.env.local');

function isPrivateIpv4(address) {
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(address) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(address)
  );
}

function findLanIpv4() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addresses] of Object.entries(interfaces)) {
    for (const entry of addresses || []) {
      if (entry.family !== 'IPv4' || entry.internal || !isPrivateIpv4(entry.address)) {
        continue;
      }

      const rank = /wi-?fi|wlan|wireless/i.test(name)
        ? 0
        : /ethernet|local area/i.test(name)
          ? 1
          : 2;
      candidates.push({ address: entry.address, name, rank });
    }
  }

  candidates.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return candidates[0];
}

const lanIp = process.env.AGENT_HOST || findLanIpv4()?.address;

if (!lanIp) {
  console.error('Could not find a LAN IPv4 address. Set AGENT_HOST manually.');
  process.exit(1);
}

const nextLine = `EXPO_PUBLIC_AGENT_API_URL=http://${lanIp}:${PORT}`;
let contents = '';

if (fs.existsSync(ENV_PATH)) {
  contents = fs.readFileSync(ENV_PATH, 'utf8');
}

if (/^EXPO_PUBLIC_AGENT_API_URL=.*$/m.test(contents)) {
  contents = contents.replace(/^EXPO_PUBLIC_AGENT_API_URL=.*$/m, nextLine);
} else {
  contents = `${contents.trimEnd()}${contents.trimEnd() ? os.EOL : ''}${nextLine}${os.EOL}`;
}

fs.writeFileSync(ENV_PATH, contents, 'utf8');
console.log(`${nextLine} written to ${ENV_PATH}`);
