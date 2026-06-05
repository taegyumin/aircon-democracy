// postinstall: monorepo에서 react-native가 root로 hoist되면 react-native-gesture-handler
// 같은 라이브러리가 자기 옆 (../react-native/...)에서 못 찾음. apps/mobile/node_modules/
// 에 symlink 만들어서 양쪽에 노출.
//
// EAS Build cloud (Linux)에서도 npm install 직후 자동 실행됨.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'node_modules', 'react-native');
const mobileNodeModules = path.join(root, 'apps', 'mobile', 'node_modules');
const dest = path.join(mobileNodeModules, 'react-native');

if (!fs.existsSync(src)) {
  // root에 react-native 없음 — apps/mobile에 직접 설치된 케이스. 종료.
  process.exit(0);
}

if (fs.existsSync(dest)) {
  const stat = fs.lstatSync(dest);
  if (stat.isSymbolicLink()) process.exit(0); // 이미 symlink
  // 실제 디렉토리면 안전을 위해 그대로 둠 (npm이 다시 설치할 수 있음)
  process.exit(0);
}

fs.mkdirSync(mobileNodeModules, { recursive: true });
fs.symlinkSync(src, dest, 'dir');
console.log(`[link-rn-for-mobile] symlinked ${dest} → ${src}`);
