import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('branding', ROOT / 'branding/apply.py')
branding = importlib.util.module_from_spec(spec)
spec.loader.exec_module(branding)

class BrandingTests(unittest.TestCase):
    def product(self, quality):
        return branding.brand({
            'win32ContextMenu': {'x64': {}, 'arm64': {}},
            'updateUrl': 'https://upstream.invalid',
            'configurationSync': {'url': 'https://upstream.invalid'},
            'extensionsGallery': {'serviceUrl': 'https://open-vsx.org/vscode/gallery'},
        }, quality)

    def test_channel_isolation(self):
        stable, insider = self.product('stable'), self.product('insider')
        keys = ['nameShort', 'applicationName', 'dataFolderName', 'serverDataFolderName',
                'darwinBundleIdentifier', 'darwinProfileUUID', 'darwinProfilePayloadUUID',
                'linuxDesktopName', 'credentialServiceName', 'win32MutexName',
                'win32AppUserModelId', 'urlProtocol', 'win32x64AppId', 'win32arm64AppId',
                'win32x64UserAppId', 'win32arm64UserAppId']
        for key in keys:
            with self.subTest(key=key):
                self.assertNotEqual(stable[key], insider[key])
                self.assertNotRegex(stable[key].lower(), 'vscodium|code-oss|visualstudio')
        self.assertEqual(stable['dataFolderName'], '.gucedit')
        self.assertEqual(insider['dataFolderName'], '.gucedit-insiders')
        self.assertEqual(stable['sharedDataFolderName'], '.gucedit-shared')
        self.assertNotEqual(stable['win32ContextMenu'], insider['win32ContextMenu'])

    def test_services_and_idempotency(self):
        for quality in ('stable', 'insider'):
            product = self.product(quality)
            self.assertNotIn('updateUrl', product)
            self.assertNotIn('configurationSync', product)
            self.assertFalse(product['enableTelemetry'])
            self.assertEqual(product['extensionsGallery']['serviceUrl'], 'https://open-vsx.org/vscode/gallery')
            self.assertEqual(product, branding.brand(dict(product), quality))

    def test_identifiers_unique(self):
        channels = json.loads((ROOT / 'branding/identifiers.json').read_text())
        ids = [value for channel in channels.values() for value in channel.values()]
        self.assertEqual(len(ids), len(set(ids)))

    def test_unknown_channel_fails(self):
        with self.assertRaises(ValueError):
            self.product('typo')
