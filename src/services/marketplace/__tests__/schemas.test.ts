import {
	validateMetadata,
	validateAnyMetadata,
	repositoryMetadataSchema,
	componentMetadataSchema,
	packageMetadataSchema,
} from "../schemas"

describe("Schema Validation", () => {
	describe("validateMetadata", () => {
		it("should validate repository metadata", () => {
			const data = {
				name: "Test Repository",
				description: "A test repository",
				version: "1.0.0",
				tags: ["test"],
			}

			expect(() => validateMetadata(data, repositoryMetadataSchema)).not.toThrow()
		})

		it("should validate component metadata", () => {
			const data = {
				name: "Test Component",
				description: "A test component",
				version: "1.0.0",
				type: "mcp",
				tags: ["test"],
			}

			expect(() => validateMetadata(data, componentMetadataSchema)).not.toThrow()
		})

		it("should validate package metadata", () => {
			const data = {
				name: "Test Package",
				description: "A test package",
				version: "1.0.0",
				type: "package",
				items: [{ type: "mcp", path: "../external/server" }],
			}

			expect(() => validateMetadata(data, packageMetadataSchema)).not.toThrow()
		})

		it("should throw error for missing required fields", () => {
			const data = {
				description: "Missing name",
				version: "1.0.0",
			}

			expect(() => validateMetadata(data, repositoryMetadataSchema)).toThrow("name: Name is required")
		})

		it("should throw error for invalid version format", () => {
			const data = {
				name: "Test",
				description: "Test",
				version: "invalid",
			}

			expect(() => validateMetadata(data, repositoryMetadataSchema)).toThrow(
				"version: Version must be in semver format",
			)
		})
	})

	describe("validateAnyMetadata", () => {
		it("should auto-detect and validate repository metadata", () => {
			const data = {
				name: "Test Repository",
				description: "A test repository",
				version: "1.0.0",
			}

			expect(() => validateAnyMetadata(data)).not.toThrow()
		})

		it("should auto-detect and validate component metadata", () => {
			const data = {
				name: "Test Component",
				description: "A test component",
				version: "1.0.0",
				type: "mcp",
			}

			expect(() => validateAnyMetadata(data)).not.toThrow()
		})

		it("should auto-detect and validate package metadata", () => {
			const data = {
				name: "Test Package",
				description: "A test package",
				version: "1.0.0",
				type: "package",
				items: [{ type: "mcp", path: "../external/server" }],
			}

			expect(() => validateAnyMetadata(data)).not.toThrow()
		})

		it("should throw error for unknown component type", () => {
			const data = {
				name: "Test",
				description: "Test",
				version: "1.0.0",
				type: "unknown",
			}

			expect(() => validateAnyMetadata(data)).toThrow("Unknown component type: unknown")
		})

		it("should throw error for invalid external item reference", () => {
			const data = {
				name: "Test Package",
				description: "Test package",
				version: "1.0.0",
				type: "package",
				items: [{ type: "unknown", path: "../external/server" }],
			}

			expect(() => validateAnyMetadata(data)).toThrow('type: Invalid value "unknown"')
		})

		it("should throw error for non-object input", () => {
			expect(() => validateAnyMetadata("not an object")).toThrow("Invalid metadata: must be an object")
		})

		it("should throw error for null input", () => {
			expect(() => validateAnyMetadata(null)).toThrow("Invalid metadata: must be an object")
		})
	})
})
