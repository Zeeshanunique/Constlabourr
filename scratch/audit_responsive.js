const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.resolve(__dirname, '../src'));
const findings = [];

files.forEach(file => {
  const relPath = path.relative(path.resolve(__dirname, '..'), file);
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    // Check fixed height (greater than 36, excluding shadowOffset or icons/avatars)
    const heightMatch = line.match(/^\s*height:\s*(\d+)/);
    if (heightMatch) {
      const val = parseInt(heightMatch[1], 10);
      if (val >= 36) {
        // Look backwards up to 10 lines for the style name
        let styleName = 'unknown';
        for (let j = idx - 1; j >= Math.max(0, idx - 15); j--) {
          const styleMatch = lines[j].match(/^\s*([a-zA-Z0-9_]+):\s*\{/);
          if (styleMatch) {
            styleName = styleMatch[1];
            break;
          }
        }
        findings.push({
          file: relPath,
          line: lineNum,
          type: 'fixed_height',
          styleName,
          value: val,
          text: line.trim()
        });
      }
    }

    // Check fixed width (greater than 60, excluding icons)
    const widthMatch = line.match(/^\s*width:\s*(\d+)/);
    if (widthMatch) {
      const val = parseInt(widthMatch[1], 10);
      if (val >= 60 && val < 500) {
        let styleName = 'unknown';
        for (let j = idx - 1; j >= Math.max(0, idx - 15); j--) {
          const styleMatch = lines[j].match(/^\s*([a-zA-Z0-9_]+):\s*\{/);
          if (styleMatch) {
            styleName = styleMatch[1];
            break;
          }
        }
        if (!styleName.toLowerCase().includes('avatar') && !styleName.toLowerCase().includes('icon') && !styleName.toLowerCase().includes('logo') && !styleName.toLowerCase().includes('img') && !styleName.toLowerCase().includes('image')) {
          findings.push({
            file: relPath,
            line: lineNum,
            type: 'fixed_width',
            styleName,
            value: val,
            text: line.trim()
          });
        }
      }
    }
  });
});

console.log(`Found ${findings.length} potential layout constraints:`);
const byFile = {};
findings.forEach(f => {
  byFile[f.file] = byFile[f.file] || [];
  byFile[f.file].push(f);
});

for (const [file, items] of Object.entries(byFile)) {
  console.log(`\n=== ${file} (${items.length} items) ===`);
  items.forEach(item => {
    console.log(`  L${item.line} [${item.type}] ${item.styleName}: ${item.text}`);
  });
}
