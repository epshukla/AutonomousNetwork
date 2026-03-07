/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SIMULATOR_URL: string;
  readonly VITE_AGENT_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
