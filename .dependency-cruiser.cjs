const isolatedLayers = ['core', 'ports', 'application'];

module.exports = {
  forbidden: [
    {
      name: 'no-cycles',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolved-imports',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    ...isolatedLayers.map((layer, index) => ({
      name: `${layer}-dependencies-point-inward`,
      severity: 'error',
      comment: 'Inner layers depend only on themselves and layers below them.',
      from: { path: `^src/${layer}/` },
      to: { pathNot: `^src/(${isolatedLayers.slice(0, index + 1).join('|')})/` },
    })),
    {
      name: 'providers-are-independent',
      severity: 'error',
      from: { path: '^src/providers/([^/]+)/' },
      to: {
        path: '^src/',
        pathNot: '^src/(core|ports)/|^src/providers/$1/',
      },
    },
    {
      name: 'integrations-are-independent',
      severity: 'error',
      from: { path: '^src/integrations/([^/]+)/' },
      to: {
        path: '^src/',
        pathNot: '^src/(core|ports|application)/|^src/integrations/$1/',
      },
    },
    {
      name: 'root-entry-is-host-independent',
      severity: 'error',
      from: { path: '^src/index\\.ts$' },
      to: { path: '^src/(providers|integrations|composition)/' },
    },
    {
      name: 'production-does-not-import-tests',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^tests/|\\.test\\.ts$' },
    },
    {
      name: 'no-runtime-development-dependencies',
      severity: 'error',
      from: { path: '^src/' },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      conditionNames: ['types', 'import', 'node', 'default'],
      exportsFields: ['exports'],
    },
  },
};
