const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Configure resolver to handle path aliases
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
  extraNodeModules: new Proxy(
    {},
    {
      get: (target, name) => {
        if (name === '@') {
          return path.resolve(__dirname, 'src');
        }
        return path.join(__dirname, `node_modules/${name}`);
      },
    }
  ),
};

module.exports = withNativeWind(config, { input: './src/index.css' });
