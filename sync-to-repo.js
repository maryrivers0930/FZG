#!/usr/bin/env node
/**
 * Sync a .pmdata file into data/sync.pmdata (for one-click publish path)
 * and optionally embed it into index.html SNAP_DATA (for full snapshot path).
 *
 * Usage:
 *   node sync-to-repo.js <path-to-file.pmdata>          # updates data/sync.pmdata only
 *   node sync-to-repo.js <path-to-file.pmdata> --embed  # also updates SNAP_DATA in index.html
 */
const fs = require('fs');
const path = require('path');

const [,, pmdataPath, flag] = process.argv;
if(!pmdataPath){ console.error('Usage: node sync-to-repo.js <file.pmdata> [--embed]'); process.exit(1); }

const fullPath = path.resolve(pmdataPath);
if(!fs.existsSync(fullPath)){ console.error('File not found:', fullPath); process.exit(1); }

let pkg;
try { pkg = JSON.parse(fs.readFileSync(fullPath, 'utf8')); }
catch(e){ console.error('Invalid JSON:', e.message); process.exit(1); }

if(pkg.magic !== 'PMDATA'){ console.error('Not a valid .pmdata file (magic mismatch)'); process.exit(1); }

const repoRoot = path.resolve(__dirname);

// Always update data/sync.pmdata
const syncPath = path.join(repoRoot, 'data', 'sync.pmdata');
fs.mkdirSync(path.dirname(syncPath), { recursive: true });
fs.writeFileSync(syncPath, JSON.stringify(pkg, null, 2));
console.log(`✓ Updated ${path.relative(repoRoot, syncPath)}`);

// Optionally embed into SNAP_DATA in index.html
if(flag === '--embed'){
  const htmlPath = path.join(repoRoot, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // Replace SNAP_DATA constant — match from "const SNAP_DATA = {" to the closing "};"
  // followed by a blank line or the SNAP_CF constant
  const snapRe = /const SNAP_DATA = \{[\s\S]*?\};\s*\n(?=\n|\/\/ This line|const SNAP_CF|const SNAP_MGMT)/;
  const newSnap = `const SNAP_DATA = ${JSON.stringify(pkg)};\n\n`;

  if(!snapRe.test(html)){
    console.error('Could not locate SNAP_DATA in index.html — skipping embed');
    process.exit(1);
  }

  html = html.replace(snapRe, newSnap);
  fs.writeFileSync(htmlPath, html);
  console.log('✓ Embedded SNAP_DATA into index.html');
}

console.log(`\nEntities: ${(pkg.entities||[]).map(e=>e.name+' ('+Object.values(e.dealsByPeriod||{}).flat().length+' deals)').join(', ')}`);
console.log(`Synced at: ${pkg._syncedAt}`);
console.log('\nNext step: git add data/sync.pmdata && git commit -m "Sync project data" && git push');
