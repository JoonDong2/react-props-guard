const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

fs.writeFileSync(
  path.join(root, 'lib/module/package.json'),
  JSON.stringify({ type: 'module' }, null, 2) + '\n',
);

fs.writeFileSync(
  path.join(root, 'lib/commonjs/package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
);
