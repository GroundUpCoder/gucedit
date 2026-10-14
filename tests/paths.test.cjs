// Exercise the prepared upstream resolver itself, without installing Electron.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const product = JSON.parse(fs.readFileSync(path.join(root, 'vscode/product.json'), 'utf8'));
let source = fs.readFileSync(path.join(root, 'vscode/src/vs/platform/environment/node/userDataPath.ts'), 'utf8');
// Supply only the resolver's Node imports; its argv import is a compile-time type.
source = source.replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '');
source = stripTypeScriptTypes(source);

function resolveData(platform, env = {}, args = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const context = vm.createContext({
    process: { platform, env, cwd: () => platform === 'win32' ? 'C:\\work' : '/work' },
    homedir: () => platform === 'win32' ? 'C:\\Users\\tester' : '/users/tester',
    resolve: paths.resolve, isAbsolute: paths.isAbsolute, join: paths.join,
  });
  vm.runInContext(source, context);
  return context.getUserDataPath(args, product.nameShort);
}
test('platform settings paths are isolated', () => {
  assert.deepEqual({
    mac: resolveData('darwin'),
    linux: resolveData('linux'),
    xdg: resolveData('linux', { XDG_CONFIG_HOME: '/custom/config' }),
    windows: resolveData('win32', { APPDATA: 'C:\\Users\\tester\\AppData\\Roaming' }),
  }, {
    mac: '/users/tester/Library/Application Support/GucEdit',
    linux: '/users/tester/.config/GucEdit',
    xdg: '/custom/config/GucEdit',
    windows: 'C:\\Users\\tester\\AppData\\Roaming\\GucEdit',
  });
});
test('development and explicit overrides', () => {
  assert.deepEqual({
    dev: resolveData('darwin', { VSCODE_DEV: '1' }),
    custom: resolveData('linux', {}, { 'user-data-dir': '/custom/profile' }),
    portable: resolveData('linux', { VSCODE_PORTABLE: '/portable' }),
    appdata: resolveData('linux', { VSCODE_APPDATA: '/appdata' }),
  }, {
    dev: '/users/tester/Library/Application Support/gucedit-dev',
    custom: '/custom/profile', portable: '/portable/user-data', appdata: '/appdata/GucEdit',
  });
});
test('prepared extension and server roots use the branded product', () => {
  const environment = fs.readFileSync(path.join(root, 'vscode/src/vs/platform/environment/common/environmentService.ts'), 'utf8');
  assert.match(environment, /joinPath\(this.userHome, this.productService.dataFolderName, 'extensions'\)/);
  assert.match(environment, /joinPath\(this.userHome, this.productService.sharedDataFolderName\)/);
  assert.deepEqual({ home: product.dataFolderName, shared: product.sharedDataFolderName,
    server: product.serverDataFolderName, app: product.applicationName, update: product.updateUrl,
  }, { home: '.gucedit', shared: '.gucedit-shared', server: '.gucedit-server', app: 'gucedit', update: undefined });
});
