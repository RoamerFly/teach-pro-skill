"""Optional, cross-platform OS credential storage through keyring."""
from __future__ import annotations

import hashlib
import json

KEYRING_REQUIREMENT = 'keyring==25.7.0'
SERVICE = 'TeachPro'
# Only local OS vaults; reject plaintext/file, remote and null plugins.
SYSTEM_BACKENDS = {
    'keyring.backends.Windows.WinVaultKeyring',
    'keyring.backends.macOS.Keyring',
    'keyring.backends.SecretService.Keyring',
    'keyring.backends.kwallet.DBusKeyring',
    'keyring.backends.kwallet.DBusKeyringKWallet4',
    'keyring.backends.kwallet.DBusKeyringKWallet5',
}


class CredentialError(Exception):
    pass


def system_backend():
    try:
        import keyring
    except ImportError:
        raise CredentialError('密钥存储尚未就绪，请检查启动窗口的环境准备结果；联网后重新启动课程即可。') from None
    try:
        selected = keyring.get_keyring()
        name = type(selected).__module__ + '.' + type(selected).__name__
        candidates = selected.backends if name == 'keyring.backends.chainer.ChainerBackend' else [selected]
        for backend in candidates:
            identity = type(backend).__module__ + '.' + type(backend).__name__
            if identity in SYSTEM_BACKENDS and backend.priority > 0:
                return backend
    except Exception:
        pass  # Do not reflect plugin error bodies or credential details.
    raise CredentialError('系统凭据服务不可用，请启用或解锁钥匙串/桌面密钥环；仍可使用会话模式。')


def capability():
    try:
        backend = system_backend()
        return {'available': True, 'backend': type(backend).__module__ + '.' + type(backend).__name__, 'hint': ''}
    except CredentialError as exc:
        return {'available': False, 'backend': 'session', 'hint': str(exc)}


def binding(root, settings):
    parts = [str(root.resolve()), *(settings.get(k, '') for k in ('kind', 'base_url', 'mode'))]
    return hashlib.sha256(json.dumps(parts, ensure_ascii=False).encode()).hexdigest()


class CredentialStore:
    def __init__(self, root):
        self.root = root.resolve()
        self.account = hashlib.sha256(str(self.root).encode()).hexdigest()

    def operate(self, action, payload=None):
        backend = system_backend()
        try:
            if action == 'write':
                backend.set_password(SERVICE, self.account, payload)
            elif action == 'read':
                return backend.get_password(SERVICE, self.account)
            elif backend.get_password(SERVICE, self.account) is not None:
                backend.delete_password(SERVICE, self.account)
        except Exception:
            raise CredentialError('系统凭据读取、保存或删除失败，请解锁后重试。') from None

    def save(self, settings, key):
        self.operate('write', json.dumps({'binding': binding(self.root, settings), 'api_key': key}))

    def load(self, settings):
        payload = self.operate('read')
        if payload is None:
            return ''
        try:
            if not isinstance(payload, str) or len(payload) > 4096:
                raise ValueError()
            data = json.loads(payload)
            if data['binding'] != binding(self.root, settings):
                return ''
            key = data['api_key']
            if not isinstance(key, str) or not 1 <= len(key) <= 512 or any(ord(c) < 32 or ord(c) > 126 for c in key):
                raise ValueError()
            return key
        except (ValueError, KeyError, TypeError):
            raise CredentialError('已保存密钥格式无效，请重新输入。') from None

    def delete(self):
        self.operate('delete')
