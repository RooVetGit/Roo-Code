import { resolve } from "path"
import fs from "fs"
import { execSync } from "child_process"

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

const writePortToFile = () => {
	return {
		name: "write-port-to-file",
		configureServer(server) {
			server.httpServer?.once("listening", () => {
				const address = server.httpServer.address()
				const port = typeof address === "object" && address ? address.port : null

				if (port) {
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

function getGitSha() {
	let gitSha: string | undefined = undefined

	try {
		gitSha = execSync("git rev-parse HEAD").toString().trim()
	} catch (e) {}

	return gitSha
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
	let outDir = "../src/webview-ui/build"

	const define: Record<string, any> = {
		"process.platform": JSON.stringify(process.platform),
	}

	// TODO: We can use `@roo-code/build` to generate `define` once the
	// monorepo is deployed.
	if (mode === "nightly") {
		outDir = "../apps/vscode-nightly/build/webview-ui/build"

		const { name, version } = JSON.parse(fs.readFileSync("../apps/vscode-nightly/package.nightly.json", "utf8"))

		define["process.env.PKG_NAME"] = JSON.stringify(name)
		define["process.env.PKG_VERSION"] = JSON.stringify(version)
		define["process.env.PKG_OUTPUT_CHANNEL"] = JSON.stringify("Roo-Code-Nightly")

		const gitSha = getGitSha()

		if (gitSha) {
			define["process.env.PKG_SHA"] = JSON.stringify(gitSha)
		}
	}

	return {
		plugins: [react(), tailwindcss(), writePortToFile(), wasmPlugin()],
		resolve: {
			alias: {
				"@": resolve(__dirname, "./src"),
				"@src": resolve(__dirname, "./src"),
				"@roo": resolve(__dirname, "../src"),
			},
		},
		build: {
			outDir,
			emptyOutDir: true,
			reportCompressedSize: false,
			sourcemap: true,
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
		define,
		optimizeDeps: {
			exclude: ["@vscode/codicons", "vscode-oniguruma", "shiki"],
		},
		assetsInclude: ["**/*.wasm", "**/*.wav"],
	}
})
