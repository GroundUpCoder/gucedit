import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TelemetryService } from '../vscode/src/vs/platform/telemetry/common/telemetryService.js';
import { supportsTelemetry, getTelemetryLevel } from '../vscode/src/vs/platform/telemetry/common/telemetryUtils.js';
import { OneDataSystemAppender } from '../vscode/src/vs/platform/telemetry/node/1dsAppender.js';
import { ExtHostTelemetry } from '../vscode/src/vs/workbench/api/common/extHostTelemetry.js';
import { resolveMachineId, resolveSqmId, resolveDevDeviceId, validateDevDeviceId } from '../vscode/src/vs/platform/telemetry/electron-main/telemetryUtils.js';
import { WorkbenchAssignmentService } from '../vscode/src/vs/workbench/services/assignment/common/assignmentService.js';

test('telemetry never reads configuration or dispatches data even when requested', async () => {
	const poison = new Proxy({}, { get() { throw new Error('Unexpected infrastructure access'); } });
	assert.equal(supportsTelemetry(poison as never, poison as never), false);
	assert.equal(getTelemetryLevel(poison as never), 0);
	const service = new TelemetryService(poison);
	service.publicLog('event', poison);
	service.publicLogError('error', poison);
	const appender = new OneDataSystemAppender(poison, true, 'test', poison, () => { throw new Error('SDK initialized'); });
	appender.log('event', poison);
	await appender.flush();
	service.dispose();
});

test('extension telemetry APIs cannot invoke or flush a sender', () => {
	const service = new ExtHostTelemetry();
	const sender = new Proxy({}, { get() { throw new Error('Sender accessed'); } });
	service.$initializeTelemetryLevel(3, true, { usage: true, error: true });
	service.$onDidChangeTelemetryLevel(3);
	const logger = service.instantiateLogger({}, sender);
	logger.logUsage('event');
	logger.logError(new Error('synthetic'));
	logger.dispose();
	assert.deepEqual(service.getTelemetryDetails(), { isCrashEnabled: false, isErrorsEnabled: false, isUsageEnabled: false });
	assert.equal(service.getTelemetryConfiguration(), false);
	service.dispose();
});

test('machine identifiers and experiments do not access OS, state or network services', async () => {
	const poison = new Proxy({}, { get() { throw new Error('Service accessed'); } });
	assert.deepEqual(await Promise.all([resolveMachineId(poison), resolveSqmId(poison), resolveDevDeviceId(poison)]), ['', '', '']);
	await validateDevDeviceId(poison);
	const assignments = new WorkbenchAssignmentService(poison);
	assert.deepEqual(await assignments.getCurrentExperiments(), []);
	assert.equal(await assignments.getTreatment('example'), undefined);
	assignments.dispose();
});
