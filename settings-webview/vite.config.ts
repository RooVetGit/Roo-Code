import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 3001, // Different port than webview-ui
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
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/test/setup.ts",
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		emptyOutDir: true,
		rollupOptions: {
			output: {
				entryFileNames: "assets/[name].js",
				chunkFileNames: "assets/[name].js",
				assetFileNames: "assets/[name].[ext]",
			},
		},
	},
})
