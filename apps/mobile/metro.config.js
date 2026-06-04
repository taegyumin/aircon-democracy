// Monorepo-aware metro config for Expo + expo-router.
// 1. watchFolders: 루트까지 watch (packages/core 등 workspace 변경 감지)
// 2. nodeModulesPaths: mobile 우선, root fallback — hoist된 deps 찾기
// 3. disableHierarchicalLookup: workspace 경계 밖에서 의도치 않은 resolve 차단
// 4. unstable_allowRequireContext: expo-router의 require.context 활성화 (필수)

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
config.transformer.unstable_allowRequireContext = true;

module.exports = config;
