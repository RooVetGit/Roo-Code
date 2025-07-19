import { describe, it, expect } from "vitest"
import {
	extractCommandPatterns,
	getPatternDescription,
	parseCommandAndOutput,
	detectSecurityIssues,
} from "../commandPatterns"

describe("extractCommandPatterns", () => {
	it("should extract simple command", () => {
		const patterns = extractCommandPatterns("ls")
		expect(patterns).toEqual(["ls"])
	})

	it("should extract command with arguments", () => {
		const patterns = extractCommandPatterns("npm install express")
		expect(patterns).toEqual(["npm", "npm install", "npm install express"])
	})

	it("should handle piped commands", () => {
		const patterns = extractCommandPatterns("ls -la | grep test")
		expect(patterns).toContain("ls")
		expect(patterns).toContain("grep")
		expect(patterns).toContain("grep test")
	})

	it("should handle chained commands with &&", () => {
		const patterns = extractCommandPatterns("npm install && npm run build")
		expect(patterns).toContain("npm")
		expect(patterns).toContain("npm install")
		expect(patterns).toContain("npm run")
		expect(patterns).toContain("npm run build")
	})

	it("should handle chained commands with ||", () => {
		const patterns = extractCommandPatterns("npm test || npm run test:ci")
		expect(patterns).toContain("npm")
		expect(patterns).toContain("npm test")
		expect(patterns).toContain("npm run")
		expect(patterns).toContain("npm run test:ci")
	})

	it("should handle semicolon separated commands", () => {
		const patterns = extractCommandPatterns("cd src; npm install")
		expect(patterns).toContain("cd")
		expect(patterns).toContain("cd src")
		expect(patterns).toContain("npm")
		expect(patterns).toContain("npm install")
	})

	it("should stop at flags", () => {
		const patterns = extractCommandPatterns('git commit -m "test message"')
		expect(patterns).toContain("git")
		expect(patterns).toContain("git commit")
		expect(patterns).not.toContain("git commit -m")
	})

	it("should stop at paths with slashes", () => {
		const patterns = extractCommandPatterns("cd /usr/local/bin")
		expect(patterns).toContain("cd")
		expect(patterns).not.toContain("cd /usr/local/bin")
	})

	it("should handle empty or null input", () => {
		expect(extractCommandPatterns("")).toEqual([])
		expect(extractCommandPatterns("   ")).toEqual([])
		expect(extractCommandPatterns(null as any)).toEqual([])
		expect(extractCommandPatterns(undefined as any)).toEqual([])
	})

	it("should handle complex command with multiple operators", () => {
		const patterns = extractCommandPatterns('npm install && npm test | grep success || echo "failed"')
		expect(patterns).toContain("npm")
		expect(patterns).toContain("npm install")
		expect(patterns).toContain("npm test")
		expect(patterns).toContain("grep")
		expect(patterns).toContain("grep success")
		expect(patterns).toContain("echo")
	})

	it("should handle malformed commands gracefully", () => {
		const patterns = extractCommandPatterns("npm install && ")
		expect(patterns).toContain("npm")
		expect(patterns).toContain("npm install")
	})

	it("should extract main command even if parsing fails", () => {
		// Create a command that might cause parsing issues
		const patterns = extractCommandPatterns('echo "unclosed quote')
		expect(patterns).toContain("echo")
	})

	it("should handle commands with special characters in arguments", () => {
		const patterns = extractCommandPatterns("git add .")
		expect(patterns).toContain("git")
		expect(patterns).toContain("git add")
		expect(patterns).not.toContain("git add .")
	})

	it("should return sorted patterns", () => {
		const patterns = extractCommandPatterns("npm run build && git push")
		expect(patterns).toEqual([...patterns].sort())
	})
})

describe("getPatternDescription", () => {
	it("should return pattern followed by commands", () => {
		expect(getPatternDescription("cd")).toBe("cd commands")
		expect(getPatternDescription("npm")).toBe("npm commands")
		expect(getPatternDescription("npm install")).toBe("npm install commands")
		expect(getPatternDescription("git")).toBe("git commands")
		expect(getPatternDescription("git push")).toBe("git push commands")
		expect(getPatternDescription("python")).toBe("python commands")
	})

	it("should handle any command pattern", () => {
		expect(getPatternDescription("unknowncommand")).toBe("unknowncommand commands")
		expect(getPatternDescription("custom-tool")).toBe("custom-tool commands")
	})

	it("should handle package managers", () => {
		expect(getPatternDescription("yarn")).toBe("yarn commands")
		expect(getPatternDescription("pnpm")).toBe("pnpm commands")
		expect(getPatternDescription("bun")).toBe("bun commands")
	})

	it("should handle build tools", () => {
		expect(getPatternDescription("make")).toBe("make commands")
		expect(getPatternDescription("cmake")).toBe("cmake commands")
		expect(getPatternDescription("cargo")).toBe("cargo commands")
		expect(getPatternDescription("go build")).toBe("go build commands")
	})
})

describe("parseCommandAndOutput", () => {
	it("should parse command with $ prefix", () => {
		const text = "$ npm install\nInstalling packages..."
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("npm install")
		expect(result.output).toBe("Installing packages...")
	})

	it("should parse command with ❯ prefix", () => {
		const text = "❯ git status\nOn branch main"
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("git status")
		expect(result.output).toBe("On branch main")
	})

	it("should parse command with > prefix", () => {
		const text = "> echo hello\nhello"
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("echo hello")
		expect(result.output).toBe("hello")
	})

	it("should return original text if no command prefix found", () => {
		const text = "npm install"
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("npm install")
		expect(result.output).toBe("")
	})

	it("should extract AI suggestions from output", () => {
		const text = "$ npm install\nSuggested patterns: npm, npm install, npm run"
		const result = parseCommandAndOutput(text)
		expect(result.suggestions).toEqual(["npm", "npm install", "npm run"])
	})

	it("should extract suggestions with different formats", () => {
		const text = "$ git push\nCommand patterns: git, git push"
		const result = parseCommandAndOutput(text)
		expect(result.suggestions).toEqual(["git", "git push"])
	})

	it('should extract suggestions from "you can allow" format', () => {
		const text = "$ docker run\nYou can allow: docker, docker run"
		const result = parseCommandAndOutput(text)
		expect(result.suggestions).toEqual(["docker", "docker run"])
	})

	it("should extract suggestions from bullet points", () => {
		const text = `$ npm test
Output here...
- npm
- npm test
- npm run`
		const result = parseCommandAndOutput(text)
		expect(result.suggestions).toContain("npm")
		expect(result.suggestions).toContain("npm test")
		expect(result.suggestions).toContain("npm run")
	})

	it("should extract suggestions from various bullet formats", () => {
		const text = `$ command
• npm
* git
- docker
▪ python`
		const result = parseCommandAndOutput(text)
		expect(result.suggestions).toContain("npm")
		expect(result.suggestions).toContain("git")
		expect(result.suggestions).toContain("docker")
		expect(result.suggestions).toContain("python")
	})

	it("should extract suggestions with backticks", () => {
		const text = "$ npm install\n- `npm`\n- `npm install`"
		const result = parseCommandAndOutput(text)
		expect(result.suggestions).toContain("npm")
		expect(result.suggestions).toContain("npm install")
	})

	it("should handle empty text", () => {
		const result = parseCommandAndOutput("")
		expect(result.command).toBe("")
		expect(result.output).toBe("")
		expect(result.suggestions).toEqual([])
	})

	it("should handle multiline commands", () => {
		const text = `$ npm install \\
  express \\
  mongoose
Installing...`
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("npm install \\")
		expect(result.output).toContain("express")
	})

	it("should include all suggestions from comma-separated list", () => {
		const text = "$ test\nSuggested patterns: npm, npm install, npm run"
		const result = parseCommandAndOutput(text)
		expect(result.suggestions).toEqual(["npm", "npm install", "npm run"])
	})

	it("should handle case variations in suggestion patterns", () => {
		const text = "$ test\nSuggested Patterns: npm, git\nCommand Patterns: docker"
		const result = parseCommandAndOutput(text)
		// Now it should accumulate all suggestions
		expect(result.suggestions).toContain("npm")
		expect(result.suggestions).toContain("git")
		expect(result.suggestions).toContain("docker")
	})

	it("should handle text already split by Output:", () => {
		const text = "npm install && cd backend\nOutput:\ngithub-pr-contributors-tracker@1.0.0 prepare"
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("npm install && cd backend")
		expect(result.output).toBe("github-pr-contributors-tracker@1.0.0 prepare")
	})

	it("should preserve original command when Output: separator is present", () => {
		const text = "npm install\nOutput:\n$ npm install\nInstalling packages..."
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("npm install")
		expect(result.output).toBe("$ npm install\nInstalling packages...")
	})

	it("should handle Output: separator with no output", () => {
		const text = "ls -la\nOutput:"
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("ls -la")
		expect(result.output).toBe("")
	})

	it("should handle Output: separator with whitespace", () => {
		const text = "git status\nOutput:  \n  On branch main  "
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe("git status")
		expect(result.output).toBe("On branch main")
	})

	it("should only use first Output: occurrence as separator", () => {
		const text = 'echo "test"\nOutput:\nFirst output\nOutput: Second output'
		const result = parseCommandAndOutput(text)
		expect(result.command).toBe('echo "test"')
		expect(result.output).toBe("First output\nOutput: Second output")
	})
})

describe("detectSecurityIssues", () => {
	it("should detect subshell execution with $()", () => {
		const warnings = detectSecurityIssues("echo $(malicious)")
		expect(warnings).toHaveLength(1)
		expect(warnings[0].type).toBe("subshell")
		expect(warnings[0].message).toContain("subshell execution")
	})

	it("should detect subshell execution with backticks", () => {
		const warnings = detectSecurityIssues("echo `malicious`")
		expect(warnings).toHaveLength(1)
		expect(warnings[0].type).toBe("subshell")
		expect(warnings[0].message).toContain("subshell execution")
	})

	it("should detect nested subshells", () => {
		const warnings = detectSecurityIssues("echo $(echo $(date))")
		expect(warnings).toHaveLength(1)
		expect(warnings[0].type).toBe("subshell")
	})

	it("should detect subshells in complex commands", () => {
		const warnings = detectSecurityIssues("npm install && echo $(whoami) || git push")
		expect(warnings).toHaveLength(1)
		expect(warnings[0].type).toBe("subshell")
	})

	it("should not detect issues in safe commands", () => {
		const warnings = detectSecurityIssues("npm install express")
		expect(warnings).toHaveLength(0)
	})

	it("should handle empty commands", () => {
		const warnings = detectSecurityIssues("")
		expect(warnings).toHaveLength(0)
	})

	it("should detect multiple subshell patterns", () => {
		const warnings = detectSecurityIssues("echo $(date) && echo `whoami`")
		expect(warnings).toHaveLength(1) // Should still be 1 warning for subshell presence
		expect(warnings[0].type).toBe("subshell")
	})

	it("should detect subshells in quoted strings", () => {
		const warnings = detectSecurityIssues('echo "Current user: $(whoami)"')
		expect(warnings).toHaveLength(1)
		expect(warnings[0].type).toBe("subshell")
	})
})

describe("security integration with extractCommandPatterns", () => {
	it("should not include subshell content in patterns", () => {
		const patterns = extractCommandPatterns("echo $(malicious)")
		expect(patterns).toContain("echo")
		expect(patterns).not.toContain("$(malicious)")
		expect(patterns).not.toContain("malicious")
	})

	it("should handle commands with subshells properly", () => {
		const patterns = extractCommandPatterns("npm install && echo $(whoami)")
		expect(patterns).toContain("npm")
		expect(patterns).toContain("npm install")
		expect(patterns).toContain("echo")
		expect(patterns).not.toContain("whoami")
	})

	it("should extract patterns from commands with backtick subshells", () => {
		const patterns = extractCommandPatterns("git commit -m `date`")
		expect(patterns).toContain("git")
		expect(patterns).toContain("git commit")
		expect(patterns).not.toContain("date")
	})
})
