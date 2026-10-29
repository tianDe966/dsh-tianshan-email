/**
 * Bundle the browser half into `lib/client.js`.
 *
 * The harness loads a plugin's client code through its own module loader:
 * `window.__ModuleLoader__.load({ id, factory })`, where `factory(require)` is a
 * CommonJS-style function that returns the module exports. React and the other
 * harness packages stay external, because the loader provides them — bundling a
 * second copy of React would break hooks.
 *
 * Usage: node build.mjs
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))

await build({
  entryPoints: ['src/client/index.js'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: ['es2020'],
  jsx: 'transform',
  external: ['react', 'react-dom', 'react/jsx-runtime', '@deepseek-ai/*'],
  legalComments: 'none',
  banner: {
    js: [
      'window.__ModuleLoader__.load({',
      `  id: ${JSON.stringify(pkg.name)},`,
      '  factory: (require) => {',
      '    "use strict";',
      '    var module = { exports: {} };',
      '    var exports = module.exports;',
      '    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    ].join('\n'),
  },
  footer: {
    js: '    return module.exports;\n  }\n});',
  },
})

console.log('built lib/client.js')
