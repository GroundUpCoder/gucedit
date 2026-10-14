import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EncryptionMainService } from '../vscode/src/vs/platform/encryption/electron-main/encryptionMainService.js';
import { NullLogService } from '../vscode/src/vs/platform/log/common/log.js';
import { InMemoryStorageService, StorageScope, StorageTarget } from '../vscode/src/vs/platform/storage/common/storage.js';
import { NativeSecretStorageService } from '../vscode/src/vs/workbench/services/secrets/electron-browser/secretStorageService.js';

test('extension secrets work within a window without touching encryption or persistent storage', async () => {
	const disk = new InMemoryStorageService();
	const encryption = new EncryptionMainService();
	for (const method of ['encrypt', 'decrypt', 'isEncryptionAvailable', 'getKeyStorageProvider', 'setUsePlainTextEncryption'] as const) {
		encryption[method] = async () => { throw new Error(`Unexpected encryption call: ${method}`); };
	}
	const log = new NullLogService();
	const first = new NativeSecretStorageService(disk, encryption, log);
	const second = new NativeSecretStorageService(disk, encryption, log);
	try {
		const changes: string[] = [];
		const subscription = first.onDidChangeSecret(key => changes.push(key));
		try {
			await first.set('example.token', 'test-only-value');
			assert.equal(await first.get('example.token'), 'test-only-value');
			assert.deepEqual(await first.keys(), ['example.token']);
			assert.equal(await second.get('example.token'), undefined, 'A fresh window must not recover the secret');
			assert.deepEqual(disk.keys(StorageScope.APPLICATION, StorageTarget.MACHINE), [], 'No secret is written to application storage');
			await first.delete('example.token');
			assert.equal(await first.get('example.token'), undefined);
			assert.deepEqual(changes, ['example.token', 'example.token']);
		} finally {
			subscription.dispose();
		}
	} finally {
		first.dispose();
		second.dispose();
		disk.dispose();
	}
});

test('persistent encryption is unavailable and never falls back to plaintext', async () => {
	const encryption = new EncryptionMainService();
	assert.equal(await encryption.isEncryptionAvailable(), false);
	await assert.rejects(encryption.encrypt('test-only-value'), /disabled/);
	await assert.rejects(encryption.decrypt('old-ciphertext'), /disabled/);
	await assert.rejects(encryption.setUsePlainTextEncryption(), /disabled/);
});

test('existing encrypted entries are neither loaded nor removed', async () => {
	const disk = new InMemoryStorageService();
	disk.store('secret://old.token', 'opaque-existing-ciphertext', StorageScope.APPLICATION, StorageTarget.MACHINE);
	const service = new NativeSecretStorageService(disk, new EncryptionMainService(), new NullLogService());
	try {
		assert.equal(await service.get('old.token'), undefined);
		await service.set('old.token', 'new-session-only-value');
		await service.delete('old.token');
		assert.equal(disk.get('secret://old.token', StorageScope.APPLICATION), 'opaque-existing-ciphertext');
	} finally {
		service.dispose();
		disk.dispose();
	}
});
