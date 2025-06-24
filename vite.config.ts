import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

// Plugin, das env.js / version.json aus dem Build entfernt
function stripSvelteKitMeta(): Plugin {
	return {
		name: 'strip-sveltekit-meta',
		generateBundle(_options, bundle) {
			// Lösche alle Bundle-Einträge, die auf env.js oder version.json enden
			for (const key of Object.keys(bundle)) {
				if (key.endsWith('env.js') || key.endsWith('version.json')) {
					delete (bundle as any)[key];
				}
			}

			// Entferne Importreferenzen auf env.js in allen Chunks
			for (const [, chunk] of Object.entries(bundle)) {
				if (chunk.type === 'chunk') {
					// Typ Narrowing für TS
					const c = chunk as unknown as { code: string };
					// Ersetze Importzeilen wie: import { env } from "./env.js";
					c.code = c.code.replace(/import[^\n]*['\"]\.\/env\.js['\"];?\n?/g, '');
				}
			}
		},
		async closeBundle() {
			// @ts-ignore — Node built-ins, we don't need typings here
			const fs: any = await import('fs');
			// @ts-ignore
			const path: any = await import('path');
			const outDir = 'build/_app';
			for (const file of ['env.js', 'version.json']) {
				const target = path.resolve(outDir, file);
				if (fs.existsSync(target)) {
					try {
						fs.unlinkSync(target);
					} catch {}
				}
			}
		}
	};
}

export default defineConfig({
	plugins: [sveltekit(), stripSvelteKitMeta()]
});
