/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the API, e.g. http://127.0.0.1:3001. Empty = same origin (/api, proxied by Vite in dev). */
  readonly VITE_API_BASE_URL?: string
  /** Minutes of inactivity before the vault locks itself (default 15, 0 = never). */
  readonly VITE_AUTO_LOCK_MINUTES?: string
}
