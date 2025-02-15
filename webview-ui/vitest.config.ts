import { defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config"

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			environment: "jsdom",
			globals: true,
			setupFiles: ["./src/setupTests.ts"],
			include: ["src/**/*.{test,spec}.{ts,tsx}"],
			coverage: {
				reporter: ["text", "json", "html"],
				exclude: ["**/node_modules/**", "**/dist/**", "**/*.d.ts", "**/src/setupTests.ts"],
			},
			// Preserve existing module name mapping from Jest config
			moduleNameMapper: {
				"^\\.(css|less|scss|sass)$": "identity-obj-proxy",
				"^vscrui$": "<rootDir>/src/__mocks__/vscrui.ts",
				"^@vscode/webview-ui-toolkit/react$": "<rootDir>/src/__mocks__/@vscode/webview-ui-toolkit/react.ts",
				"^@/(.*)$": "<rootDir>/src/$1",
			},
		},
	}),
)
