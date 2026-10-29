const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const sourceDir = path.join(projectRoot, 'edge');
const targets = ['chrome', 'brave'];

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Source extension folder not found: ${sourceDir}`);
}

function copyDirectory(source, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(source, destination, { recursive: true });
}

for (const browser of targets) {
  const destination = path.join(projectRoot, browser);
  copyDirectory(sourceDir, destination);

  const manifestPath = path.join(destination, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`manifest.json not found in ${sourceDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // Chrome and Brave both use the Chromium extension manifest format.
  // Keep the manifest unchanged so the verified Edge behavior is preserved.
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Built ${browser} extension at ${destination}`);
}
