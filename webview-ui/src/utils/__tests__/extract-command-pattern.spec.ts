import { describe, it, expect } from "vitest"
import { extractCommandPattern, getPatternDescription } from "../extract-command-pattern"

describe("extractCommandPattern", () => {
	it("handles empty or null input", () => {
		expect(extractCommandPattern("")).toBe("")
		expect(extractCommandPattern("   ")).toBe("")
		expect(extractCommandPattern(null as any)).toBe("")
		expect(extractCommandPattern(undefined as any)).toBe("")
	})

	describe("npm/yarn/pnpm/bun commands", () => {
		it("extracts npm run patterns", () => {
			expect(extractCommandPattern("npm run build")).toBe("npm run build")
			expect(extractCommandPattern("npm run test:unit")).toBe("npm run *")
			expect(extractCommandPattern("yarn run dev")).toBe("yarn run dev")
			expect(extractCommandPattern("pnpm run lint")).toBe("pnpm run lint")
			expect(extractCommandPattern("bun run start")).toBe("bun run start")
		})

		it("handles npm run with additional arguments", () => {
			expect(extractCommandPattern("npm run build:prod -- --env=production")).toBe("npm run build:prod")
			expect(extractCommandPattern("npm run test -- --coverage")).toBe("npm run test")
			expect(extractCommandPattern("npm run build:dev --watch")).toBe("npm run *")
		})

		it("extracts npm script patterns", () => {
			expect(extractCommandPattern("npm test")).toBe("npm test")
			expect(extractCommandPattern("npm build")).toBe("npm build")
			expect(extractCommandPattern("npm start")).toBe("npm start")
			expect(extractCommandPattern("yarn test")).toBe("yarn test")
			expect(extractCommandPattern("pnpm build")).toBe("pnpm build")
		})

		it("handles npm with flags", () => {
			expect(extractCommandPattern("npm install --save-dev")).toBe("npm install")
			expect(extractCommandPattern("npm test -- --coverage")).toBe("npm test")
			expect(extractCommandPattern("npm -v")).toBe("npm")
		})
	})

	describe("git commands", () => {
		it("extracts git subcommands", () => {
			expect(extractCommandPattern("git commit -m 'message'")).toBe("git commit")
			expect(extractCommandPattern("git push origin main")).toBe("git push")
			expect(extractCommandPattern("git pull --rebase")).toBe("git pull")
			expect(extractCommandPattern("git checkout -b feature")).toBe("git checkout")
		})

		it("handles git with flags only", () => {
			expect(extractCommandPattern("git --version")).toBe("git")
		})
	})

	describe("script files", () => {
		it("preserves full script paths", () => {
			expect(extractCommandPattern("./scripts/deploy.sh production")).toBe("./scripts/deploy.sh")
			expect(extractCommandPattern("/usr/local/bin/backup.sh")).toBe("/usr/local/bin/backup.sh")
			expect(extractCommandPattern("scripts/test.py --verbose")).toBe("scripts/test.py")
			expect(extractCommandPattern("./build.js --watch")).toBe("./build.js")
		})
	})

	describe("interpreters", () => {
		it("extracts just the interpreter", () => {
			expect(extractCommandPattern("python script.py --arg value")).toBe("python")
			expect(extractCommandPattern("python3 -m pytest")).toBe("python3")
			expect(extractCommandPattern("node index.js --port 3000")).toBe("node")
			expect(extractCommandPattern("ruby app.rb")).toBe("ruby")
			expect(extractCommandPattern("java -jar app.jar")).toBe("java")
		})
	})

	describe("dangerous commands", () => {
		it("extracts just the base command", () => {
			expect(extractCommandPattern("rm -rf node_modules")).toBe("rm")
			expect(extractCommandPattern("mv old.txt new.txt")).toBe("mv")
			expect(extractCommandPattern("chmod 755 script.sh")).toBe("chmod")
			expect(extractCommandPattern("find . -name '*.log' -delete")).toBe("find")
		})
	})

	describe("chained commands", () => {
		it("extracts patterns from all commands in chain", () => {
			expect(extractCommandPattern("cd /path && npm install")).toBe("cd * && npm install")
			expect(extractCommandPattern("npm test || echo 'failed'")).toBe("npm test || echo")
			expect(extractCommandPattern("git pull; npm install; npm run build")).toBe(
				"git pull ; npm install ; npm run build",
			)
			expect(extractCommandPattern("echo 'start' | grep start")).toBe("echo | grep")
		})

		it("handles complex chained commands with wildcards", () => {
			expect(extractCommandPattern("cd /path/to/project && npm run build:prod --verbose")).toBe(
				"cd * && npm run *",
			)
		})
	})

	describe("docker/kubectl commands", () => {
		it("extracts docker subcommands", () => {
			expect(extractCommandPattern("docker run -it ubuntu")).toBe("docker run")
			expect(extractCommandPattern("docker build -t myapp .")).toBe("docker build")
			expect(extractCommandPattern("kubectl get pods")).toBe("kubectl get")
			expect(extractCommandPattern("kubectl apply -f config.yaml")).toBe("kubectl apply")
			expect(extractCommandPattern("helm install myapp ./chart")).toBe("helm install")
		})
	})

	describe("make commands", () => {
		it("extracts make targets", () => {
			expect(extractCommandPattern("make build")).toBe("make build")
			expect(extractCommandPattern("make test")).toBe("make test")
			expect(extractCommandPattern("make clean install")).toBe("make clean")
			expect(extractCommandPattern("make -j4")).toBe("make")
		})
	})

	describe("quoted arguments", () => {
		it("handles single quotes", () => {
			expect(extractCommandPattern("echo 'hello world'")).toBe("echo")
			expect(extractCommandPattern("git commit -m 'feat: add feature'")).toBe("git commit")
		})

		it("handles double quotes", () => {
			expect(extractCommandPattern('echo "hello world"')).toBe("echo")
			expect(extractCommandPattern('npm run "test:unit"')).toBe("npm run *")
		})

		it("handles quotes with spaces", () => {
			expect(extractCommandPattern('git commit -m "fix: resolve issue #123"')).toBe("git commit")
			expect(extractCommandPattern("echo 'multiple   spaces'")).toBe("echo")
		})
	})

	describe("edge cases", () => {
		it("handles commands with redirects", () => {
			expect(extractCommandPattern("npm test > output.log")).toBe("npm test")
			expect(extractCommandPattern("echo hello 2>&1")).toBe("echo")
		})

		it("handles cd command", () => {
			expect(extractCommandPattern("cd /home/user/project")).toBe("cd *")
			expect(extractCommandPattern("cd ..")).toBe("cd *")
			expect(extractCommandPattern("cd")).toBe("cd *")
			expect(extractCommandPattern("cd /usr/local/bin")).toBe("cd *")
		})

		it("handles commands with environment variables", () => {
			expect(extractCommandPattern("NODE_ENV=production npm start")).toBe("NODE_ENV=*")
			expect(extractCommandPattern("PORT=3000 node server.js")).toBe("PORT=*")
		})

		it("handles dangerous commands more carefully", () => {
			expect(extractCommandPattern("rm -rf /")).toBe("rm")
			expect(extractCommandPattern("rm -rf node_modules")).toBe("rm")
			expect(extractCommandPattern("find . -name '*.log' -delete")).toBe("find")
		})

		it("handles command injection patterns", () => {
			expect(extractCommandPattern("echo $(whoami)")).toBe("echo")
			expect(extractCommandPattern("echo `date`")).toBe("echo")
			expect(extractCommandPattern("bash -c 'echo hello'")).toBe("bash")
		})

		it("limits deeply chained commands", () => {
			const deepChain = "echo 1 && echo 2 && echo 3 && echo 4 && echo 5"
			const result = extractCommandPattern(deepChain)
			// Should stop at some point to prevent overly complex patterns
			expect(result).toBe("echo")
		})
	})
})

describe("getPatternDescription", () => {
	it("describes npm patterns", () => {
		expect(getPatternDescription("npm run")).toBe("npm run scripts")
		expect(getPatternDescription("npm test")).toBe("npm test commands")
		expect(getPatternDescription("npm")).toBe("npm commands")
		expect(getPatternDescription("yarn run")).toBe("yarn run scripts")
		expect(getPatternDescription("pnpm build")).toBe("pnpm build commands")
	})

	it("describes git patterns", () => {
		expect(getPatternDescription("git commit")).toBe("git commit commands")
		expect(getPatternDescription("git push")).toBe("git push commands")
		expect(getPatternDescription("git")).toBe("git commands")
	})

	it("describes script patterns", () => {
		expect(getPatternDescription("./scripts/deploy.sh")).toBe("this specific script")
		expect(getPatternDescription("/usr/bin/backup.py")).toBe("this specific script")
	})

	it("describes interpreter patterns", () => {
		expect(getPatternDescription("python")).toBe("python scripts")
		expect(getPatternDescription("node")).toBe("node scripts")
		expect(getPatternDescription("ruby")).toBe("ruby scripts")
	})

	it("describes docker/kubectl patterns", () => {
		expect(getPatternDescription("docker run")).toBe("docker run commands")
		expect(getPatternDescription("kubectl get")).toBe("kubectl get commands")
		expect(getPatternDescription("helm install")).toBe("helm install commands")
	})

	it("describes make patterns", () => {
		expect(getPatternDescription("make build")).toBe("make build target")
		expect(getPatternDescription("make test")).toBe("make test target")
		expect(getPatternDescription("make")).toBe("make commands")
	})

	it("describes cd pattern", () => {
		expect(getPatternDescription("cd")).toBe("directory navigation")
	})

	it("describes generic patterns", () => {
		expect(getPatternDescription("echo")).toBe("echo commands")
		expect(getPatternDescription("rm")).toBe("rm commands")
		expect(getPatternDescription("custom-tool")).toBe("custom-tool commands")
	})

	it("handles empty input", () => {
		expect(getPatternDescription("")).toBe("")
		expect(getPatternDescription(null as any)).toBe("")
	})
})
