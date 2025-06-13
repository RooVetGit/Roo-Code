import path from "path"
import { RooProtectedController } from "../RooProtectedController"

describe("RooProtectedController", () => {
	const TEST_CWD = "/test/workspace"
	let controller: RooProtectedController

	beforeEach(() => {
		controller = new RooProtectedController(TEST_CWD)
	})

	describe("isWriteProtected", () => {
		it("should protect .rooignore file", () => {
			expect(controller.isWriteProtected(".rooignore")).toBe(true)
		})

		it("should protect files in .roo directory", () => {
			expect(controller.isWriteProtected(".roo/config.json")).toBe(true)
			expect(controller.isWriteProtected(".roo/settings/user.json")).toBe(true)
			expect(controller.isWriteProtected(".roo/modes/custom.json")).toBe(true)
		})

		it("should protect roo.json file", () => {
			expect(controller.isWriteProtected("roo.json")).toBe(true)
		})

		it("should protect .rooprotected file", () => {
			expect(controller.isWriteProtected(".rooprotected")).toBe(true)
		})

		it("should protect files starting with .roo", () => {
			expect(controller.isWriteProtected(".roosettings")).toBe(true)
			expect(controller.isWriteProtected(".rooconfig")).toBe(true)
		})

		it("should not protect regular files", () => {
			expect(controller.isWriteProtected("src/index.ts")).toBe(false)
			expect(controller.isWriteProtected("package.json")).toBe(false)
			expect(controller.isWriteProtected("README.md")).toBe(false)
		})

		it("should not protect files that contain 'roo' but don't start with .roo", () => {
			expect(controller.isWriteProtected("src/roo-utils.ts")).toBe(false)
			expect(controller.isWriteProtected("config/roo.config.js")).toBe(false)
		})

		it("should handle nested paths correctly", () => {
			expect(controller.isWriteProtected("src/.roo/config.json")).toBe(true) // .roo/** matches anywhere
			expect(controller.isWriteProtected("nested/.rooignore")).toBe(true) // .rooignore matches anywhere by default
		})

		it("should handle absolute paths by converting to relative", () => {
			const absolutePath = path.join(TEST_CWD, ".rooignore")
			expect(controller.isWriteProtected(absolutePath)).toBe(true)
		})

		it("should handle paths with different separators", () => {
			expect(controller.isWriteProtected(".roo\\config.json")).toBe(true)
			expect(controller.isWriteProtected(".roo/config.json")).toBe(true)
		})
	})

	describe("getProtectedFiles", () => {
		it("should return set of protected files from a list", () => {
			const files = ["src/index.ts", ".rooignore", "package.json", ".roo/config.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set([".rooignore", ".roo/config.json", "roo.json"]))
		})

		it("should return empty set when no files are protected", () => {
			const files = ["src/index.ts", "package.json", "README.md"]

			const protectedFiles = controller.getProtectedFiles(files)

			expect(protectedFiles).toEqual(new Set())
		})
	})

	describe("annotatePathsWithProtection", () => {
		it("should annotate paths with protection status", () => {
			const files = ["src/index.ts", ".rooignore", ".roo/config.json", "package.json"]

			const annotated = controller.annotatePathsWithProtection(files)

			expect(annotated).toEqual([
				{ path: "src/index.ts", isProtected: false },
				{ path: ".rooignore", isProtected: true },
				{ path: ".roo/config.json", isProtected: true },
				{ path: "package.json", isProtected: false },
			])
		})
	})

	describe("getProtectionMessage", () => {
		it("should return appropriate protection message", () => {
			const message = controller.getProtectionMessage()
			expect(message).toBe("This is a Roo configuration file and requires approval for modifications")
		})
	})

	describe("getInstructions", () => {
		it("should return formatted instructions about protected files", () => {
			const instructions = controller.getInstructions()

			expect(instructions).toContain("# Protected Files")
			expect(instructions).toContain("write-protected")
			expect(instructions).toContain(".rooignore")
			expect(instructions).toContain(".roo/**")
			expect(instructions).toContain("roo.json")
			expect(instructions).toContain("\u{1F6E1}") // Shield symbol
		})
	})

	describe("getProtectedPatterns", () => {
		it("should return the list of protected patterns", () => {
			const patterns = RooProtectedController.getProtectedPatterns()

			expect(patterns).toEqual([".rooignore", ".roo/**", ".rooprotected", ".roo*"])
		})
	})
})
