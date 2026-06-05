// Monorepo-aware metro config for Expo + expo-router.
// 1. watchFolders: 루트까지 watch (packages/core 등 workspace 변경 감지)
// 2. nodeModulesPaths: mobile 우선, root fallback — hoist된 deps 찾기
// 3. unstable_allowRequireContext: expo-router의 require.context 활성화 (필수)
//
// disableHierarchicalLookup은 OFF로 둠 — react-native가 자기 자체
// node_modules의 nested deps (@react-native/virtualized-lists 등)를
// 찾아야 하기 때문. true로 두면 EAS Build 단계에서 Metro fail.

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
config.transformer.unstable_allowRequireContext = true;

module.exports = config;
