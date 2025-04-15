/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
	transform: {
		"^.+\\.tsx?$": [
			"ts-jest",
			{
				tsconfig: {
					module: "CommonJS",
					moduleResolution: "node",
					esModuleInterop: true,
					allowJs: true,
				},
				diagnostics: false,
				isolatedModules: true,
			},
		],
	},
	testMatch: ["**/__tests__/**/*.test.ts"],
	moduleNameMapper: {
		"^chalk$": "<rootDir>/__tests__/__mocks__/chalk.js",
		"^ora$": "<rootDir>/__tests__/__mocks__/ora.js",
	},
	roots: ["<rootDir>/src", "<rootDir>/__tests__"],
	collectCoverage: true,
	collectCoverageFrom: ["src/**/*.ts", "!src/index.ts", "!src/**/*.d.ts"],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov"],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80,
		},
	},
}
