// Verify the actual packaged Mac app and its corresponding bundler source maps.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'VSCode-darwin-arm64/GucEdit.app/Contents/Resources/app');
function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(p);
    else if (entry.isFile()) yield p;
  }
}
const prohibited = /\/(?:platform\/(?:agentHost|localTranscription)\/(?:node|electron-main)|platform\/mcp\/node|workbench\/contrib\/(?:agentsVoice|speech)\/browser|workbench\/contrib\/chat\/browser\/(?:voiceClient|widget\/chatWidget\.ts)|workbench\/contrib\/chat\/common\/(?:chatService\/chatServiceImpl|promptSyntax\/service\/promptsServiceImpl|plugins\/pluginMarketplaceService)|workbench\/api\/common\/extHost(?:ChatAgents|LanguageModels|Mcp|Speech))/;
for (const p of files(path.join(root, 'vscode/out-vscode-min'))) {
  if (!p.endsWith('.js.map')) continue;
  for (const source of JSON.parse(fs.readFileSync(p, 'utf8')).sources) {
    assert.ok(!prohibited.test(source), `AI implementation bundled: ${source} in ${p}`);
  }
}
for (const p of files(path.join(app, 'out'))) {
  assert.ok(!/\/vs\/(?:platform\/(?:agentHost|localTranscription)|sessions)\//.test(p), `AI entry point/resource shipped: ${p}`);
  if (p.endsWith('.js')) assert.ok(!/falcon-caas\.mai\.microsoft\.com|voice-code\/api\/v1\/realtime\/voice/.test(fs.readFileSync(p, 'utf8')), `Voice endpoint shipped: ${p}`);
}
const product = JSON.parse(fs.readFileSync(path.join(app, 'product.json'), 'utf8'));
for (const key of ['defaultChatAgent', 'voiceWsUrl', 'agentsTelemetryAppName', 'aiConfig']) assert.ok(!(key in product), `AI product configuration: ${key}`);
// ASAR's header is a Chromium pickle containing a JSON file tree. Read only that header.
const fd = fs.openSync(path.join(app, 'node_modules.asar'), 'r');
try {
  const prefix = Buffer.alloc(16);
  fs.readSync(fd, prefix, 0, prefix.length, 0);
  const header = Buffer.alloc(prefix.readUInt32LE(12));
  fs.readSync(fd, header, 0, header.length, 16);
  const tree = JSON.parse(header.toString());
  for (const modulePath of ['@vscode/copilot-api', '@github/copilot-sdk', '@github/copilot', 'foundry-local-sdk']) {
    let entry = tree;
    for (const segment of modulePath.split('/')) entry = entry?.files?.[segment];
    assert.ok(!entry, `AI SDK packaged: ${modulePath}`);
  }
} finally { fs.closeSync(fd); }
console.log('PASS: no AI runtime entry points, agent/voice/MCP implementations, voice URL, or AI SDKs in the packaged application');
