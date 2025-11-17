/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly BASE_URL: string;
	readonly DEV: boolean;
	readonly MODE: string;
	readonly PROD: boolean;
	readonly SSR: boolean;
	readonly VITE_API_URL?: string;
	readonly VITE_APP_ID?: string;
	readonly VITE_NOTE_SESSION_ID?: string;
	[key: string]: string | boolean | undefined;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
