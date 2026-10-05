"""Synthetic credentials only; common API tests and optional native Windows vault."""
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

ASSETS = Path(__file__).resolve().parents[1] / 'teach-pro/assets'
sys.path.insert(0, str(ASSETS))
import credential_store as vault

spec = importlib.util.spec_from_file_location('credential_tutor', ASSETS / 'tutor_chat.py')
tutor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tutor)
DATA = {'kind': 'custom', 'provider': 'Synthetic', 'model': 'demo', 'mode': 'local',
        'base_url': 'http://127.0.0.1:11434/v1', 'api_key': 'synthetic-test-only',
        'max_tokens': 4096, 'thinking': 'disabled', 'remember_key': True}


def backend(identity):
    module, name = identity.rsplit('.', 1)
    return type(name, (), {'__module__': module, 'priority': 1,
                           'set_password': Mock(), 'get_password': Mock(return_value=None),
                           'delete_password': Mock()})()


class KeyringAdapterTests(unittest.TestCase):
    def test_common_interface_supports_each_approved_os_backend(self):
        for identity in vault.SYSTEM_BACKENDS:
            selected = backend(identity)
            with self.subTest(identity=identity), patch.dict(sys.modules, {'keyring': SimpleNamespace(get_keyring=lambda: selected)}):
                self.assertTrue(vault.capability()['available'])
                with tempfile.TemporaryDirectory() as directory:
                    store = vault.CredentialStore(Path(directory))
                    store.save(DATA, DATA['api_key'])
                    service, account, payload = selected.set_password.call_args.args
                    self.assertEqual(service, 'TeachPro')
                    self.assertEqual(account, store.account)
                    selected.get_password.return_value = payload
                    self.assertEqual(store.load(DATA), DATA['api_key'])
                    self.assertEqual(store.load(dict(DATA, base_url='http://127.0.0.1:9999/v1')), '')
                    store.delete()
                    selected.delete_password.assert_called_once_with(service, account)

    def test_missing_library_keeps_session_mode(self):
        with patch.dict(sys.modules, {'keyring': None}):
            result = vault.capability()
            self.assertFalse(result['available'])
            self.assertIn('--install-keyring', result['hint'])

    def test_missing_library_does_not_silently_change_default_to_session(self):
        with tempfile.TemporaryDirectory() as directory, patch.dict(sys.modules, {'keyring': None}), \
                patch.object(tutor, 'validate_endpoint'), patch.object(tutor, 'CONFIG', None), \
                patch.object(tutor, 'RESTORED_ROOT', None), patch.object(tutor, 'RESTORE_ERROR', ''):
            root = Path(directory)
            data = {k: v for k, v in DATA.items() if k != 'remember_key'}
            with self.assertRaises(tutor.TutorError):
                tutor.configure(root, data)
            self.assertFalse((root / '.tutor-settings.json').exists())
            self.assertTrue(tutor.configure(root, dict(data, remember_key=False))['configured'])
            self.assertFalse(tutor.config_status(root)['key_saved'])

    def test_plaintext_remote_null_and_fail_backends_are_rejected(self):
        for identity in ['keyrings.alt.file.PlaintextKeyring', 'keyring.backends.null.Keyring',
                         'keyring.backends.fail.Keyring', 'remote.credentials.Keyring']:
            selected = backend(identity)
            with self.subTest(identity=identity), patch.dict(sys.modules, {'keyring': SimpleNamespace(get_keyring=lambda: selected)}):
                self.assertFalse(vault.capability()['available'])
                selected.set_password.assert_not_called()

    def test_chainer_never_uses_plaintext_fallback(self):
        unsafe = backend('keyrings.alt.file.PlaintextKeyring')
        safe = backend('keyring.backends.SecretService.Keyring')
        chain = backend('keyring.backends.chainer.ChainerBackend')
        chain.backends = [unsafe, safe]
        with patch.dict(sys.modules, {'keyring': SimpleNamespace(get_keyring=lambda: chain)}):
            self.assertIs(vault.system_backend(), safe)
        unsafe.get_password.assert_not_called()

    def test_backend_errors_do_not_reflect_private_details(self):
        selected = backend('keyring.backends.Windows.WinVaultKeyring')
        selected.get_password.side_effect = RuntimeError('synthetic-private-body')
        with patch.dict(sys.modules, {'keyring': SimpleNamespace(get_keyring=lambda: selected)}), tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(vault.CredentialError) as error:
                vault.CredentialStore(Path(directory)).load(DATA)
            self.assertNotIn('synthetic-private-body', str(error.exception))

    def test_absent_item_delete_is_idempotent(self):
        selected = backend('keyring.backends.Windows.WinVaultKeyring')
        with patch.dict(sys.modules, {'keyring': SimpleNamespace(get_keyring=lambda: selected)}), tempfile.TemporaryDirectory() as directory:
            vault.CredentialStore(Path(directory)).delete()
        selected.delete_password.assert_not_called()

    def test_malformed_payloads_and_course_isolation(self):
        with tempfile.TemporaryDirectory() as directory:
            first = vault.CredentialStore(Path(directory) / 'first')
            other = vault.CredentialStore(Path(directory) / 'other')
            payload = json.dumps({'binding': vault.binding(first.root, DATA), 'api_key': DATA['api_key']})
            with patch.object(other, 'operate', return_value=payload):
                self.assertEqual(other.load(DATA), '')
            for value in ['', '[]', 'null', 'x' * 4097]:
                with patch.object(first, 'operate', return_value=value), self.assertRaises(vault.CredentialError):
                    first.load(DATA)


@unittest.skipUnless(sys.platform == 'win32' and vault.capability()['available'], 'Native Windows keyring not installed/available')
class NativePersistenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='teach-native-keyring-')
        self.root = Path(self.temp.name)
        self.store = vault.CredentialStore(self.root)
        self.endpoint_patch = patch.object(tutor, 'validate_endpoint')
        self.endpoint_patch.start()
        self.restart()

    def tearDown(self):
        self.store.delete()  # Only this test's synthetic course account.
        self.endpoint_patch.stop()
        self.restart()
        self.temp.cleanup()

    def restart(self):
        tutor.CONFIG = None
        tutor.RESTORED_ROOT = None
        tutor.RESTORE_ERROR = ''

    def test_native_roundtrip_restart_no_provider_call_or_key_in_status(self):
        with patch.object(tutor, 'connection', side_effect=AssertionError('No provider request')):
            self.assertTrue(tutor.configure(self.root, DATA)['key_saved'])
            self.assertNotIn(DATA['api_key'], (self.root / '.tutor-settings.json').read_text())
            self.assertEqual([p.name for p in self.root.iterdir()], ['.tutor-settings.json'])
            self.restart()
            status = tutor.config_status(self.root)
            self.assertTrue(status['configured'])
            self.assertNotIn(DATA['api_key'], json.dumps(status))
            self.assertEqual(tutor.current_config()['api_key'], DATA['api_key'])

    def test_omitted_preference_defaults_to_device_storage(self):
        data = {k: v for k, v in DATA.items() if k != 'remember_key'}
        self.assertTrue(tutor.configure(self.root, data)['key_saved'])
        self.restart()
        self.assertTrue(tutor.config_status(self.root)['configured'])

    def test_disconnect_stays_off_then_blank_key_reenable(self):
        tutor.configure(self.root, DATA)
        self.assertTrue(tutor.disconnect(self.root)['key_saved'])
        self.restart()
        self.assertFalse(tutor.config_status(self.root)['configured'])
        self.assertTrue(tutor.configure(self.root, dict(DATA, api_key=''))['configured'])

    def test_forget_deletes_native_item_and_session(self):
        tutor.configure(self.root, DATA)
        self.assertFalse(tutor.disconnect(self.root, delete_key=True)['key_saved'])
        self.assertEqual(self.store.load(DATA), '')
        self.restart()
        self.assertFalse(tutor.config_status(self.root)['configured'])

    def test_corrupt_item_does_not_restore(self):
        tutor.configure(self.root, DATA)
        self.store.operate('write', 'invalid synthetic item')
        self.restart()
        self.assertFalse(tutor.config_status(self.root)['configured'])
        self.assertTrue(tutor.config_status(self.root)['restore_error'])

    def test_session_mode_removes_saved_secret(self):
        tutor.configure(self.root, DATA)
        tutor.configure(self.root, dict(DATA, api_key='', remember_key=False))
        self.assertEqual(self.store.load(DATA), '')
        self.restart()
        self.assertFalse(tutor.config_status(self.root)['configured'])

    def test_changed_destination_cannot_restore_key(self):
        tutor.configure(self.root, DATA)
        file = self.root / '.tutor-settings.json'
        saved = json.loads(file.read_text())
        saved['base_url'] = 'http://127.0.0.1:9999/v1'
        file.write_text(json.dumps(saved))
        self.restart()
        self.assertFalse(tutor.config_status(self.root)['configured'])

    def test_malformed_saved_kind_keeps_service_available(self):
        tutor.configure(self.root, DATA)
        file = self.root / '.tutor-settings.json'
        saved = json.loads(file.read_text())
        saved['kind'] = []
        file.write_text(json.dumps(saved))
        self.restart()
        self.assertFalse(tutor.config_status(self.root)['configured'])

    def test_failed_delete_still_disconnects(self):
        tutor.configure(self.root, DATA)
        with patch.object(vault.CredentialStore, 'delete', side_effect=vault.CredentialError('Unavailable')):
            with self.assertRaises(tutor.TutorError):
                tutor.disconnect(self.root, delete_key=True)
        self.assertIsNone(tutor.CONFIG)
        self.restart()
        self.assertFalse(tutor.config_status(self.root)['configured'])


if __name__ == '__main__':
    unittest.main()
