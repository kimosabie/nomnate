const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Compile the actual source in memory; replace only external boundaries in action tests.
// No emitted files, test dependencies, credentials, network, or database are needed.
exports.load = function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const requireFromFile = createRequire(filename);
  const localRequire = (id) => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    let target;
    if (id.startsWith('.')) target = path.resolve(path.dirname(filename), id);
    else if (id.startsWith('@/')) target = path.join(root, 'apps/web/src', id.slice(2));
    else if (id === '@nomnate/shared') target = path.join(root, 'packages/shared/src/index');
    else if (id === '@nomnate/types') target = path.join(root, 'packages/types/src/index');
    if (target) return load(target + (path.extname(target) ? '' : '.ts'), mocks, cache);
    return requireFromFile(id);
  };
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
};

exports.client = function client(responses, user = { id: 'user' }) {
  const calls = [];
  return {
    calls,
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async (name, args) => {
      calls.push({ rpc: name, args });
      const queue = responses[name];
      if (!queue?.length) throw new Error('Unexpected RPC ' + name);
      return queue.shift();
    },
    from(table) {
      const call = { table, methods: [] };
      calls.push(call);
      let builder;
      builder = new Proxy({}, { get(_, method) {
        if (method === 'then') return (resolve, reject) => {
          const queue = responses[table];
          if (!queue?.length) return Promise.reject(new Error('Unexpected query ' + table)).then(resolve, reject);
          return Promise.resolve(queue.shift()).then(resolve, reject);
        };
        return (...args) => { call.methods.push([method, ...args]); return builder; };
      } });
      return builder;
    },
  };
};
