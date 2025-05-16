import { resolve } from "path"
import fs from "fs"

import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

function wasmPlugin(): Plugin {
	return {
		name: "wasm",
		async load(id: string) {
			if (id.endsWith(".wasm")) {
				const wasmBinary = await import(id)

				return `
          			const wasmModule = new WebAssembly.Module(${wasmBinary.default});
          			export default wasmModule;
        		`
			}
		},
	}
}

// Custom plugin to write the server port to a file
const writePortToFile = () => {
	return {
		name: "write-port-to-file",
		configureServer(server) {
			// Write the port to a file when the server starts
			server.httpServer?.once("listening", () => {
				const address = server.httpServer.address()
				const port = typeof address === "object" && address ? address.port : null

				if (port) {
					// Write to a file in the project root
					const portFilePath = resolve(__dirname, "../.vite-port")
					fs.writeFileSync(portFilePath, port.toString())
					console.log(`[Vite Plugin] Server started on port ${port}`)
					console.log(`[Vite Plugin] Port information written to ${portFilePath}`)
				} else {
					console.warn("[Vite Plugin] Could not determine server port")
				}
			})
		},
	}
}

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss(), writePortToFile(), wasmPlugin()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@src": resolve(__dirname, "./src"),
			"@roo": resolve(__dirname, "../src"),
		},
	},
	build: {
		outDir: "build",
		reportCompressedSize: false,
		sourcemap: true,
		rollupOptions: {
			output: {
				entryFileNames: `assets/[name].js`,
				chunkFileNames: (chunkInfo) => {
					if (chunkInfo.name === "mermaid-bundle") {
						return `assets/mermaid-bundle.js`
					}
					// Default naming for other chunks, ensuring uniqueness from entry
					return `assets/chunk-[hash].js`
				},
				assetFileNames: `assets/[name].[ext]`,
				manualChunks: (id, { getModuleInfo }) => {
					// Consolidate all mermaid code and its direct large dependencies (like dagre)
					// into a single chunk. The 'channel.js' error often points to dagre.
					if (
						id.includes("node_modules/mermaid") ||
						id.includes("node_modules/dagre") || // dagre is a common dep for graph layout
						id.includes("node_modules/cytoscape") // another potential graph lib
						// Add other known large mermaid dependencies if identified
					) {
						return "mermaid-bundle"
					}

					// Check if the module is part of any explicitly defined mermaid-related dynamic import
					// This is a more advanced check if simple path matching isn't enough.
					const moduleInfo = getModuleInfo(id)
					if (moduleInfo?.importers.some((importer) => importer.includes("node_modules/mermaid"))) {
						return "mermaid-bundle"
					}
					if (moduleInfo?.dynamicImporters.some((importer) => importer.includes("node_modules/mermaid"))) {
						return "mermaid-bundle"
					}
				},
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
		include: [
			"mermaid",
			"dagre", // Explicitly include dagre for pre-bundling
			// Add other known large mermaid dependencies if identified
		],
		exclude: ["@vscode/codicons", "vscode-oniguruma", "shiki"],
	},
	assetsInclude: ["**/*.wasm"],
})
