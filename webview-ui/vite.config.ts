import path from "path"

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import type { Plugin } from "vite"

function wasmPlugin(): Plugin {
	return {
		name: "wasm",
		async load(id: string) {
			if (id.endsWith(".wasm")) {
				const wasmBinary = await import(id)
				return `
          const wasmModule = new WebAssembly.Module(${wasmBinary});
          export default wasmModule;
        `
			}
		},
	}
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss(), wasmPlugin()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		outDir: "build",
		reportCompressedSize: false,
		rollupOptions: {
			output: {
				entryFileNames: `assets/[name].js`,
				chunkFileNames: `assets/[name].js`,
				assetFileNames: `assets/[name].[ext]`,
			},
		},
	},
	server: {
		hmr: {
			host: "localhost",
			protocol: "ws",
		},
		cors: {
			origin: "*",
			methods: "*",
			allowedHeaders: "*",
		},
	},
	define: {
		"process.platform": JSON.stringify(process.platform),
		"process.env.VSCODE_TEXTMATE_DEBUG": JSON.stringify(process.env.VSCODE_TEXTMATE_DEBUG),
	},
	optimizeDeps: {
		exclude: ["@vscode/codicons", "vscode-oniguruma", "shiki"],
	},
	assetsInclude: ["**/*.wasm"],
})
