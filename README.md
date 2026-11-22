# credential-manager-ui

Vite + React + TypeScript front end for the credential manager. Its look and feel, layout and `/mock` artboards
come from `../../link-organizer/link-organizer-ui`.

Passwords and hints are **encrypted and decrypted in this app** (`src/lib/crypto.ts`). The API only sees
ciphertext. The scheme is described in `../credential-manager-api/docs/SECURITY.md`.

## Run

```sh
npm install
npm run dev        # http://127.0.0.1:5174, proxies /api to http://127.0.0.1:3001
```

Start `credential-manager-api` first. Optional settings are in [.env.example](.env.example); copy it to
`.env.local` to change them. The API's own settings live in `/etc/app-configs/credential-manager/.env`; this app
doesn't read that file.

Design artboards: http://127.0.0.1:5174/mock/form-controls/ and http://127.0.0.1:5174/mock/application-state/.

## How it fits together

| Path | What |
| --- | --- |
| `src/vault/vault.tsx` | Sign-in, unlock, lock, auto-lock, sign-out, change password. Holds the vault key in memory only. |
| `src/lib/crypto.ts` | Argon2id → HKDF keys, vault-key wrapping, AES-256-GCM field encryption, password generator |
| `src/services/` | HTTP client (`http.ts`) and React Query hooks (`queries.ts`). The cache holds ciphertext only. |
| `src/App.tsx` | Screen switch (sign-in / unlock / dashboard) and the dashboard |
| `src/components/AccountForm.tsx` | Add/edit form: sign-in method, email drop-down of previously used addresses, sub-accounts |
| `src/components/secrets.tsx` | Masked values with show/copy, password field with generator |

Screens:

- **Sign in.** Username, password and "Remember me for 30 days".
- **Unlock.** Shown after a reload while the session is still valid. The vault key is never stored, so the
  password is needed again.
- **Dashboard.** A nested group tree, then accounts as cards or a list. Passwords and hints are hidden until you
  show them, and every value can be copied. Accounts can hold sub-accounts.
