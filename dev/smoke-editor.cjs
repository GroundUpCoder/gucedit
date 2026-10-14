// Exercise a built Mac app in an isolated profile; never touches the user's files or settings.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { chromium } = require('../vscode/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gucedit-smoke-'));
const workspace = path.join(base, 'workspace');
const extension = path.join(base, 'extension');
const profile = path.join(base, 'profile');
const report = path.join(base, 'report.json');
for (const dir of [workspace, extension, path.join(profile, 'User')]) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(profile, 'User/settings.json'), JSON.stringify({
  'security.workspace.trust.enabled': false, 'workbench.startupEditor': 'none',
  'files.hotExit': 'off', 'workbench.editor.enablePreview': false,
  'telemetry.telemetryLevel': 'all', 'workbench.enableExperiments': true,
}));
fs.writeFileSync(path.join(workspace, 'sample.ts'), 'const value = "hello";\nvalue.\n');
fs.writeFileSync(path.join(workspace, 'debug.js'), 'console.log("gucedit-debug-ok");\n');
fs.writeFileSync(path.join(workspace, 'README.md'), '# GucEdit smoke fixture\n');
spawnSync('git', ['init', '-q', workspace]);
fs.writeFileSync(path.join(extension, 'package.json'), JSON.stringify({ name: 'gucedit-smoke', publisher: 'gucedit-test', version: '0.0.1', engines: { vscode: '^1.100.0' }, main: './extension.js', activationEvents: ['onStartupFinished'] }));
fs.writeFileSync(path.join(extension, 'extension.js'), String.raw`
const vscode = require('vscode'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const wait = ms => new Promise(r => setTimeout(r, ms));
exports.activate = async context => {
 const checks=[];
 try {
  assert.equal(vscode.env.isTelemetryEnabled, false);
  const sender = { sendEventData(){throw Error('Telemetry sent');}, sendErrorData(){throw Error('Error sent');}, flush(){throw Error('Sender flushed');} };
  const logger = vscode.env.createTelemetryLogger(sender);
  logger.logUsage('test'); logger.logError(new Error('synthetic')); logger.dispose();
  checks.push('telemetry remains inert with settings enabled');
  assert.deepEqual(await vscode.lm.selectChatModels(), []);
  assert.equal(context.languageModelAccessInformation.canSendRequest({}), false);
  assert.throws(() => vscode.chat.createChatParticipant('smoke', () => {}), /not available/);
  const commands = await vscode.commands.getCommands(true);
  for (const id of ['workbench.action.chat.open', 'workbench.action.quickchat.toggle', 'scm.editor.triggerSetup']) assert.ok(!commands.includes(id), 'AI command still registered: '+id);
  checks.push('AI APIs disabled');
  await context.secrets.store('sample', 'synthetic'); assert.equal(await context.secrets.get('sample'), 'synthetic');
  await context.secrets.delete('sample'); checks.push('session secret API');
  const folder=vscode.workspace.workspaceFolders[0].uri;
  const uri=vscode.Uri.joinPath(folder,'edited.txt');
  await vscode.workspace.fs.writeFile(uri,Buffer.from('before'));
  const doc=await vscode.workspace.openTextDocument(uri); const editor=await vscode.window.showTextDocument(doc);
  await editor.edit(edit=>edit.replace(new vscode.Range(0,0,0,6),'after')); await doc.save();
  assert.equal(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString(),'after');
  checks.push('edit and save');
  const enumeration=await vscode.workspace.openTextDocument({content:'x\nx\nx'});
  const enumEditor=await vscode.window.showTextDocument(enumeration);
  enumEditor.selections=[0,1,2].map(n=>new vscode.Selection(n,0,n,1));
  await vscode.commands.executeCommand('enumerate.enumerate1');
  for(let i=0;i<30&&enumeration.getText()!=='1\n2\n3';i++)await wait(100);
  assert.equal(enumeration.getText(),'1\n2\n3');
  await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor'); checks.push('Enumerate');
  assert.ok((await vscode.workspace.findFiles('**/sample.ts')).length); checks.push('workspace file search');
  const ts=await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder,'sample.ts'));
  await vscode.window.showTextDocument(ts);
  let completions;
  for(let i=0;i<30;i++) {completions=await vscode.commands.executeCommand('vscode.executeCompletionItemProvider',ts.uri,new vscode.Position(1,6));if(completions?.items.some(i=>i.label==='charAt'||i.label?.label==='charAt'))break;await wait(500);}
  assert.ok(completions?.items.some(i=>i.label==='charAt'||i.label?.label==='charAt'),'TypeScript completion');checks.push('TypeScript completion');
  const git=await vscode.extensions.getExtension('vscode.git').activate();
  assert.ok(git.getAPI(1).repositories.some(r=>r.rootUri.fsPath===folder.fsPath));checks.push('Git repository discovery');
  const marker=path.join(folder.fsPath,'terminal-result'); const term=vscode.window.createTerminal({name:'GucEdit smoke',shellPath:'/bin/sh'});
  term.sendText('printf gucedit-terminal-ok > '+JSON.stringify(marker));
  for(let i=0;i<60&&!fs.existsSync(marker);i++)await wait(200);
  assert.equal(fs.readFileSync(marker,'utf8'),'gucedit-terminal-ok');term.dispose();checks.push('integrated terminal');
  const taskMarker=path.join(folder.fsPath,'task-result');
  const task=new vscode.Task({type:'shell'},vscode.workspace.workspaceFolders[0],'GucEdit smoke','gucedit-test',new vscode.ShellExecution('printf gucedit-task-ok > '+JSON.stringify(taskMarker)));
  await vscode.tasks.executeTask(task);
  for(let i=0;i<60&&!fs.existsSync(taskMarker);i++)await wait(200);
  assert.equal(fs.readFileSync(taskMarker,'utf8'),'gucedit-task-ok');checks.push('shell tasks');
  const notebook=await vscode.workspace.openNotebookDocument('jupyter-notebook',new vscode.NotebookData([new vscode.NotebookCellData(vscode.NotebookCellKind.Code,'print(1)','python')]));
  await vscode.window.showNotebookDocument(notebook);
  assert.equal(notebook.cellCount,1);checks.push('notebook editor');
  await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
  let debugStarted=false, debugEnded=false;
  const start=vscode.debug.onDidStartDebugSession(()=>debugStarted=true),end=vscode.debug.onDidTerminateDebugSession(()=>debugEnded=true);
  try {
   assert.equal(await vscode.debug.startDebugging(vscode.workspace.workspaceFolders[0],{type:'pwa-node',request:'launch',name:'GucEdit smoke',program:path.join(folder.fsPath,'debug.js'),runtimeExecutable:process.env.GUCEDIT_SMOKE_NODE,console:'internalConsole'}),true);
   for(let i=0;i<60&&!debugEnded;i++)await wait(250);
   assert.ok(debugStarted&&debugEnded,'Debug launch and exit');checks.push('Node debugger');
  }finally{start.dispose();end.dispose();}
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder,'README.md')));
  fs.writeFileSync(process.env.GUCEDIT_SMOKE_REPORT,JSON.stringify({ok:true,checks}));
 }catch(error){fs.writeFileSync(process.env.GUCEDIT_SMOKE_REPORT,JSON.stringify({error:error.stack,checks}));}
};
`);
(async () => {
  const appPath = process.env.GUCEDIT_SMOKE_APP || path.join(root,'VSCode-darwin-arm64/GucEdit.app/Contents/MacOS/GucEdit');
  const logPath = path.join(root,'.gucedit-tools/editor-smoke.log');
  const log = fs.openSync(logPath,'w');
  const app = spawn(appPath,['--user-data-dir',profile,'--extensions-dir',path.join(os.homedir(),'.gucedit/extensions'),'--extensionDevelopmentPath',extension,'--remote-debugging-port=9341','--skip-welcome',workspace],{env:{...process.env,GUCEDIT_SMOKE_REPORT:report,GUCEDIT_SMOKE_NODE:process.execPath},stdio:['ignore',log,log]});
  let browser;
  try {
    for(let i=0;i<240&&!fs.existsSync(report);i++){if(app.exitCode!==null)throw Error('App exited; see '+logPath);await new Promise(r=>setTimeout(r,500));}
    assert.ok(fs.existsSync(report),'Extension smoke timed out; see '+logPath);
    const result=JSON.parse(fs.readFileSync(report));assert.ok(result.ok,JSON.stringify(result));
    browser=await chromium.connectOverCDP('http://127.0.0.1:9341');
    const page=browser.contexts()[0].pages().find(p=>p.url().includes('workbench'));assert.ok(page);
    const client=await page.context().newCDPSession(page);
    const errors=[];
    client.on('Runtime.exceptionThrown', e=>errors.push(e.exceptionDetails.exception?.description||e.exceptionDetails.text));
    client.on('Runtime.consoleAPICalled', e=>{if(e.type==='error')errors.push(e.args.map(a=>a.value||a.description||'').join(' '));});
    await client.send('Runtime.enable');
    assert.equal(await page.locator('.monaco-workbench.modern-ui').count(),0);
    await page.keyboard.press('Meta+KeyP');
    await page.locator('.quick-input-widget input').first().fill('sample.ts');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.command-center').count(),0);
    await page.keyboard.press('Meta+Shift+KeyP');
    await page.locator('.quick-input-widget input').first().fill('>View: Toggle Word Wrap');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Control+Shift+Tab');
    await page.waitForFunction(()=>[...document.querySelectorAll('.tab.active')].some(e=>e.textContent.includes('sample.ts')));
    await page.keyboard.press('Control+Tab');
    await page.waitForFunction(()=>[...document.querySelectorAll('.tab.active')].some(e=>e.textContent.includes('README.md')));
    assert.deepEqual(errors.filter(e=>/NOT registered|UNKNOWN service|Unknown actor|Missing proxy|TypeError|ReferenceError/.test(e)),[], 'Workbench runtime errors');
    console.log('PASS:',result.checks.join(', ')+', classic layout, Command Palette, tab order');
  } finally {
    if(browser)await browser.close();
    app.kill('SIGTERM');await new Promise(r=>app.once('exit',r));
    fs.closeSync(log);
    fs.rmSync(base,{recursive:true,force:true});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
