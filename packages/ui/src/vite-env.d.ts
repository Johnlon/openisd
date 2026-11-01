/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_BUILD_VERSION?: string;
  /** The id every bundled catalogue file is stamped with (vite.config.js `catalogueBuild`). */
  readonly VITE_CATALOGUE_BUILD: string;
  /** 'on' in a build that ships a service worker. */
  readonly VITE_SERVICE_WORKER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
