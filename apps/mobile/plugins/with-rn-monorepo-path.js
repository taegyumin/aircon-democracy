// Custom Expo config plugin — Android prebuild이 생성하는 gradle.properties에
// REACT_NATIVE_NODE_MODULES_DIR 추가. react-native가 monorepo root로 hoist된 경우
// react-native-gesture-handler 등 일부 라이브러리가 autolink 실패 → 명시 필요.

const { withGradleProperties } = require('@expo/config-plugins');
const path = require('path');

module.exports = function withRnMonorepoPath(config) {
  return withGradleProperties(config, (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const reactNativePath = require.resolve('react-native/package.json', { paths: [projectRoot] });
    const reactNativeDir = path.dirname(reactNativePath);
    // android/gradle.properties는 apps/mobile/android/ 안. relative path 계산.
    const androidDir = path.join(projectRoot, 'android');
    const relativeRnPath = path.relative(androidDir, reactNativeDir);

    config.modResults.push({
      type: 'property',
      key: 'REACT_NATIVE_NODE_MODULES_DIR',
      value: relativeRnPath,
    });
    return config;
  });
};
