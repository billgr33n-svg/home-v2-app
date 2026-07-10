// eslint-config-expo covers React Native + TypeScript defaults.
module.exports = {
  root: true,
  extends: ['expo'],
  // supabase/functions is Deno, not RN — different globals and import syntax.
  ignorePatterns: ['/dist/*', '/node_modules/*', '/.expo/*', '/supabase/functions/*'],
};
