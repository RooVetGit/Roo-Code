#!/usr/bin/env node
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import { execa } from "execa"
import chalk from "chalk"
import prompts from "prompts"
import semver from "semver" // For robust version comparison

// --- Constants ---
const REQUIRED_NODE_VERSION = "20.18.1" // Exact version required by the project
const ASDF_PYTHON_VERSION = "3.13.2"
const ASDF_GOLANG_VERSION = "1.24.2"
const ASDF_RUST_VERSION = "1.85.1"
const JAVA_VERSION_CHECK = "17" // Check for major version 17 or higher

const VSCODE_EXTENSIONS = [
	"golang.go",
	"dbaeumer.vscode-eslint",
	"redhat.java",
	"ms-python.python",
	"rust-lang.rust-analyzer",
	"rooveterinaryinc.roo-cline", // Assuming this is the correct ID
]

const EVALS_REPO_URL = "https://github.com/cte/evals.git" // Use user's repo
const EVALS_REPO_UPSTREAM = "cte/evals" // Official upstream repo for forking
// ROOT_DIR is the current evals directory where this script is running from
const ROOT_DIR = path.resolve(process.cwd(), "..") // evals/ directory
// The target path for the external evals repo should be a sibling to Roo-Code
const EVALS_REPO_CLONE_TARGET_PATH = path.resolve(ROOT_DIR, "..", "..", "evals")
const PYTHON_VENV_PATH = path.join(ROOT_DIR, ".venv")

// --- Types ---
/** @typedef {'nodejs' | 'python' | 'golang' | 'rust' | 'java' | 'uv' | 'git' | 'gh' | 'code' | 'pnpm' | 'brew' | 'apt' | 'yum' | 'dnf' | 'winget' | 'choco' | 'asdf' | 'nvm' | 'conda'} ToolKey */
/** @typedef {{ name: ToolKey, checkCmd: string, checkArgs: string[], versionCheck?: (output: string) => boolean, installGuide: string, installCmd?: Partial<Record<PackageManager, string[]>>, asdfPlugin?: string, asdfVersion?: string, requires?: ToolKey[] }} Dependency */
/** @typedef {'brew' | 'apt' | 'yum' | 'dnf' | 'winget' | 'choco' | 'pipx' | 'pip' | 'npm' | 'asdf' | 'conda' | 'git' | 'manual'} PackageManager */

// --- State ---
const detectedPackageManager = {
	brew: false,
	apt: false,
	yum: false,
	dnf: false,
	winget: false,
	choco: false,
	git: false,
	asdf: false,
	nvm: false,
	conda: false,
}
let brewPrefix = null // Cache brew prefix

// --- Logging Helpers ---
const logInfo = (message) => console.log(chalk.blue(`💡 ${message}`))
const logSuccess = (message) => console.log(chalk.green(`✅ ${message}`))
const logWarning = (message) => console.log(chalk.yellow(`⚠️ ${message}`))
const logError = (message) => console.error(chalk.red(`🚨 ${message}`))
const logStep = (message) => console.log(chalk.cyan(`\n👉 ${message}`))
const logGuide = (message) => console.log(chalk.magenta(`🔗 ${message}`))

// --- Command Helpers ---
async function commandExists(command) {
	const checkCmd = os.platform() === "win32" ? "where" : "which"
	try {
		await execa(checkCmd, [command], { stdio: "ignore", shell: os.platform() === "win32" })
		return true
	} catch (e) {
		return false
	}
}

async function runCommand(command, args = [], options = {}) {
	const cmdString = `${command} ${args.join(" ")}`
	logInfo(`Running: ${cmdString} ${options.cwd ? `in ${options.cwd}` : ""}`)
	try {
		// Inherit stdio by default for interactive commands, allow override
		const defaultOptions = { stdio: "inherit" }
		const result = await execa(command, args, { ...defaultOptions, ...options })
		if (result.failed || result.exitCode !== 0) {
			throw new Error(`Command failed with exit code ${result.exitCode}: ${cmdString}`)
		}
		return result
	} catch (error) {
		logError(`Error running command: ${cmdString}`)
		if (error.stderr) console.error(chalk.red(error.stderr))
		if (error.stdout) console.error(chalk.red(error.stdout)) // Log stdout too on error
		throw error // Re-throw after logging
	}
}

async function getCommandOutput(command, args = [], options = {}) {
	try {
		const { stdout } = await execa(command, args, { stdio: "pipe", ...options })
		return stdout.trim()
	} catch (error) {
		// Log warning only if reject is not false, as failures are expected during checks
		if (options.reject !== false) {
			logWarning(`Command failed (expected during check?): ${command} ${args.join(" ")} - ${error.shortMessage}`)
		}
		return null
	}
}

// --- Version Comparison ---
function checkVersion(installedVersion, requiredVersionSpec) {
	try {
		// Use semver for robust comparison (handles ranges, ~, ^, etc.)
		// Clean version strings (remove 'v', 'go', 'python ', etc.)
		const cleanInstalled = installedVersion.replace(/^(v|go|python |rustc |javac )/i, "").split(" ")[0]
		return semver.satisfies(cleanInstalled, requiredVersionSpec)
	} catch (e) {
		logWarning(`Could not parse version: ${installedVersion}. Assuming mismatch.`)
		return false
	}
}

// --- Platform & Package Manager Detection ---
async function detectPlatformTools() {
	logStep("Detecting platform and package managers...")
	const platform = os.platform()
	logInfo(`Platform: ${platform}`)

	if (platform === "darwin") {
		if (await commandExists("brew")) {
			detectedPackageManager.brew = true
			brewPrefix = await getCommandOutput("brew", ["--prefix"]).catch(() => null)
			logSuccess(`Homebrew detected (prefix: ${brewPrefix || "unknown"})`)
		} else {
			logWarning("Homebrew not found.")
		}
	} else if (platform === "linux") {
		if (await commandExists("apt")) {
			detectedPackageManager.apt = true
			logSuccess("apt detected.")
		} else if (await commandExists("dnf")) {
			detectedPackageManager.dnf = true
			logSuccess("dnf detected.")
		} else if (await commandExists("yum")) {
			detectedPackageManager.yum = true
			logSuccess("yum detected.")
		} else {
			logWarning("No standard Linux package manager (apt, dnf, yum) detected.")
		}
	} else if (platform === "win32") {
		if (await commandExists("winget")) {
			detectedPackageManager.winget = true
			logSuccess("winget detected.")
		} else {
			logWarning("winget not found.")
		}
		if (await commandExists("choco")) {
			detectedPackageManager.choco = true
			logSuccess("Chocolatey detected.")
		} else {
			logWarning("Chocolatey not found.")
		}
	} else {
		logError(`Unsupported platform: ${platform}.`)
		process.exit(1)
	}

	if (await commandExists("git")) {
		detectedPackageManager.git = true
		logSuccess("Git detected.")
	} else {
		logWarning("Git not found.")
	}

	if (await commandExists("asdf")) {
		detectedPackageManager.asdf = true
		logSuccess("asdf detected.")
	} else {
		logInfo("asdf not detected.")
	}

	const nvmDir = process.env.NVM_DIR
	const nvmShExists = nvmDir && (await fs.access(path.join(nvmDir, "nvm.sh")).then(() => true).catch(() => false))
	if (nvmShExists) {
		detectedPackageManager.nvm = true
		logSuccess("nvm detected (basic check).")
	} else {
		logInfo("nvm not detected.")
	}

	if (await commandExists("conda")) {
		detectedPackageManager.conda = true
		logSuccess("Conda detected.")
	} else {
		logInfo("Conda not detected.")
	}
}

// --- Installation Helpers ---

async function installWithPackageManager(toolName, installCommands, guide) {
	let installed = false
	let pmUsed = null

	const tryInstall = async (pm, command, args) => {
		if (detectedPackageManager[pm]) {
			const { confirm } = await prompts({
				type: "confirm",
				name: "confirm",
				message: `Install ${toolName} using ${pm}? (${command} ${args.join(" ")})`,
				initial: true,
			})
			if (confirm === undefined) throw new Error("Prompt cancelled")
			if (confirm) {
				try {
					// Special handling for interactive installers like brew
					const options = pm === 'brew' ? { stdio: 'inherit' } : {};
					await runCommand(command, args, options)
					logSuccess(`${toolName} installed via ${pm}.`)
					installed = true
					pmUsed = pm
					return true // Stop trying other managers
				} catch (error) {
					logError(`Failed to install ${toolName} via ${pm}: ${error.message}`)
				}
			}
		}
		return false // Continue trying other managers
	}

	// Try platform-specific package managers first
	if (os.platform() === "darwin" && installCommands.brew && await tryInstall("brew", "brew", installCommands.brew)) return { installed, pmUsed };
	if (os.platform() === "linux") {
		if (installCommands.apt && await tryInstall("apt", "sudo", ["apt", "install", "-y", ...installCommands.apt])) return { installed, pmUsed };
		if (installCommands.dnf && await tryInstall("dnf", "sudo", ["dnf", "install", "-y", ...installCommands.dnf])) return { installed, pmUsed };
		if (installCommands.yum && await tryInstall("yum", "sudo", ["yum", "install", "-y", ...installCommands.yum])) return { installed, pmUsed };
	}
	if (os.platform() === "win32") {
		if (installCommands.winget && await tryInstall("winget", "winget", ["install", "-e", "--id", ...installCommands.winget])) return { installed, pmUsed };
		if (installCommands.choco && await tryInstall("choco", "choco", ["install", "-y", ...installCommands.choco])) return { installed, pmUsed };
	}
	// Try cross-platform managers if applicable
	if (installCommands.npm && await tryInstall("npm", "npm", ["install", "-g", ...installCommands.npm])) return { installed, pmUsed };
	if (installCommands.pipx && await tryInstall("pipx", "pipx", ["install", ...installCommands.pipx])) return { installed, pmUsed };
	if (installCommands.pip && await tryInstall("pip", (await commandExists("pip3") ? "pip3" : "pip"), ["install", "--user", ...installCommands.pip])) return { installed, pmUsed }; // Use --user for pip
	if (installCommands.git && await tryInstall("git", "git", installCommands.git)) return { installed, pmUsed }; // For git clone based installs like asdf

	if (!installed) {
		logError(`${toolName} could not be installed automatically.`)
		logGuide(`Please install manually: ${guide}`)
	}

	return { installed, pmUsed }
}

async function ensureTool(toolKey) {
	const dep = DEPENDENCIES[toolKey]
	if (!dep) {
		logError(`Unknown tool key: ${toolKey}`)
		return false
	}

	logStep(`Checking for ${dep.name}...`)
	let versionOutput = await getCommandOutput(dep.checkCmd, dep.checkArgs, { reject: false })
	let versionCorrect = false
	let needsInstall = true

	// Special stderr handling for javac
	if (toolKey === "java" && !versionOutput) {
		try {
			const { stderr } = await execa(dep.checkCmd, dep.checkArgs, { reject: false })
			versionOutput = stderr.trim()
		} catch { /* ignore */ }
	}

	if (versionOutput) {
		versionCorrect = dep.versionCheck ? dep.versionCheck(versionOutput) : true
		if (versionCorrect) {
			logSuccess(`${dep.name} found (${versionOutput.split("\n")[0]})`)
			needsInstall = false
		} else {
			logWarning(`Incorrect ${dep.name} version found (${versionOutput.split("\n")[0]}). Required: ${dep.asdfVersion || JAVA_VERSION_CHECK}`)
			needsInstall = true // Needs update/reinstall
		}
	} else {
		logWarning(`${dep.name} not found.`)
		needsInstall = true
	}

	if (needsInstall) {
		let installed = false
		let pmUsed = null

		// --- Attempt Installation/Guidance ---

		// 1. Conda (for Python - Highest Priority if available)
		if (toolKey === "python" && detectedPackageManager.conda) {
			logInfo("Attempting Python installation/check via Conda...")
			// Check current activated python
			let condaPythonVersion = await getCommandOutput("python", ["--version"], { reject: false })
			if (condaPythonVersion && dep.versionCheck(condaPythonVersion)) {
				logSuccess(`Found suitable Python in current Conda environment (${condaPythonVersion}).`)
				installed = true
				pmUsed = "conda"
			} else {
				const { installConda } = await prompts({
					type: "confirm",
					name: "installConda",
					message: `Python ${ASDF_PYTHON_VERSION} not found or incorrect in current Conda env. Install/update using 'conda install python=${ASDF_PYTHON_VERSION}'?`,
					initial: true,
				})
				if (installConda === undefined) throw new Error("Prompt cancelled")
				if (installConda) {
					try {
						await runCommand("conda", ["install", `python=${ASDF_PYTHON_VERSION}`, "-y"])
						logSuccess(`Python ${ASDF_PYTHON_VERSION} installed via Conda into the current environment.`)
						const newVersion = await getCommandOutput("python", ["--version"], { reject: false })
						if (newVersion && dep.versionCheck(newVersion)) {
							logSuccess(`Python version is now correct (${newVersion}).`)
							installed = true
							pmUsed = "conda"
						} else {
							logError("Conda installation seemed successful, but the version is still incorrect. Please check your Conda environment.")
						}
					} catch (condaError) {
						logError(`Conda installation failed: ${condaError.message}`)
					}
				}
			}
		}

		// 2. ASDF (If Conda wasn't used/applicable or failed)
		if (!installed && detectedPackageManager.asdf && dep.asdfPlugin && dep.asdfVersion) {
			logInfo(`Attempting ${dep.name} installation via asdf...`)
			const { useAsdf } = await prompts({
				type: "confirm",
				name: "useAsdf",
				message: `Use asdf to install ${dep.name} ${dep.asdfVersion}?`,
				initial: true,
			})
			if (useAsdf === undefined) throw new Error("Prompt cancelled")
			if (useAsdf) {
				try {
					try {
						await runCommand("asdf", ["plugin", "add", dep.asdfPlugin])
					} catch { /* plugin already added */ }
					await runCommand("asdf", ["install", dep.asdfPlugin, dep.asdfVersion])
					const toolVersionsPath = path.join(ROOT_DIR, ".tool-versions")
					const asdfScope = await fs.access(toolVersionsPath).then(() => "local").catch(() => "global")
					await runCommand("asdf", [asdfScope, dep.asdfPlugin, dep.asdfVersion])
					logSuccess(`${dep.name} ${dep.asdfVersion} installed and set via asdf (${asdfScope}).`)
					installed = true
					pmUsed = "asdf"
				} catch (asdfError) {
					logError(`asdf installation failed: ${asdfError.message}`)
				}
			}
		}

		// 3. System Package Managers (if not installed via conda/asdf)
		if (!installed && dep.installCmd) {
			logInfo(`Attempting ${dep.name} installation via system package manager...`)
			const result = await installWithPackageManager(dep.name, dep.installCmd, dep.installGuide)
			installed = result.installed
			pmUsed = result.pmUsed

			// Special post-install messages
			if (installed && toolKey === 'java' && pmUsed === 'brew') {
				const javaHome = await getCommandOutput("brew", ["--prefix", `openjdk@${JAVA_VERSION_CHECK}`])
				logWarning(`Java ${JAVA_VERSION_CHECK} installed via brew. You might need to add it to your PATH or set JAVA_HOME. Example for zsh/bash: export PATH="${javaHome}/bin:$PATH"`)
			}
			if (installed && pmUsed === 'pip') {
				logWarning("Installed via pip --user. Ensure the pip user binary directory is in your PATH.")
			}
			if (installed && toolKey === 'asdf' && pmUsed === 'git') {
				const asdfScriptPath = path.join(os.homedir(), ".asdf", "asdf.sh") // Default git clone location
				logWarning(`asdf installed via git. Please add 'source "${asdfScriptPath}"' to your shell config (e.g., ~/.zshrc or ~/.bashrc) and restart your terminal.`)
				process.exit(1) // Exit for user to configure shell
			}
			if (installed && toolKey === 'brew') {
				logWarning("Homebrew installation might require manual steps or password input. Please follow the prompts.")
				logWarning("After Homebrew is installed, ensure it's added to your PATH (check ~/.zprofile or ~/.bash_profile) and restart your terminal before running this script again.")
				process.exit(1) // Exit for user to complete setup
			}
		}

		// 4. Manual Installation Guidance
		if (!installed) {
			logError(`${dep.name} is required but could not be installed automatically.`)
			logGuide(`Please install manually: ${dep.installGuide}`)
			process.exit(1)
		}

		// Re-check version if installed by this script (except for conda/nvm/asdf where user manages activation/shell sourcing)
		if (installed && pmUsed !== "conda" && pmUsed !== "nvm" && pmUsed !== "asdf") {
			versionOutput = await getCommandOutput(dep.checkCmd, dep.checkArgs, { reject: false })
			if (toolKey === "java" && !versionOutput) { // Recheck stderr for java
				try {
					const { stderr } = await execa(dep.checkCmd, dep.checkArgs, { reject: false })
					versionOutput = stderr.trim()
				} catch { /* ignore */ }
			}

			if (versionOutput && (!dep.versionCheck || dep.versionCheck(versionOutput))) {
				logSuccess(`Successfully installed and verified ${dep.name}.`)
			} else {
				logError(`Installation of ${dep.name} seemed successful, but the command is still not found or version is incorrect. Please check your PATH or restart your terminal.`)
				process.exit(1)
			}
		} else if (installed && (pmUsed === "conda" || pmUsed === "nvm" || pmUsed === "asdf")) {
			// Re-check might still fail if not activated/sourced in *this* shell
			logSuccess(`Successfully installed ${dep.name} via ${pmUsed}. Ensure the correct environment/version is active or shell is configured.`)
		}
		return true // Installed successfully
	}
	return true // Already existed and version is correct
}

// --- Dependency Definitions ---
/** @type {Record<ToolKey, Dependency>} */
const DEPENDENCIES = {
	// Node.js check is primarily handled here now
	nodejs: {
		name: "nodejs",
		checkCmd: "node",
		checkArgs: ["--version"],
		versionCheck: (v) => checkVersion(v, REQUIRED_NODE_VERSION), // Exact version check
		installGuide: "https://nodejs.org/ or use nvm/asdf",
		// No installCmd here - setup.sh ensures a basic version, this script checks the exact one.
		// User is guided to use nvm/asdf if the version is wrong.
	},
	git: {
		name: "git",
		checkCmd: "git",
		checkArgs: ["--version"],
		installGuide: "https://git-scm.com/downloads",
		installCmd: {
			brew: ["install", "git"],
			apt: ["git"],
			dnf: ["git"],
			yum: ["git"],
			winget: ["Git.Git"],
			choco: ["git"],
		},
	},
	brew: { // macOS only
		name: "brew",
		checkCmd: "brew",
		checkArgs: ["--version"],
		installGuide: "https://brew.sh",
		installCmd: { // Special case, installed via curl
			manual: ["/bin/bash", "-c", "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"]
		}
	},
	asdf: {
		name: "asdf",
		checkCmd: "asdf",
		checkArgs: ["--version"],
		installGuide: "https://asdf-vm.com/guide/getting-started.html",
		installCmd: {
			brew: ["install", "asdf"],
			// Install via git clone as fallback
			git: ["clone", "https://github.com/asdf-vm/asdf.git", path.join(os.homedir(), ".asdf"), "--branch", "v0.14.0"] // Clone to ~/.asdf
		}
	},
	gh: {
		name: "gh",
		checkCmd: "gh",
		checkArgs: ["--version"],
		installGuide: "https://cli.github.com/",
		installCmd: {
			brew: ["install", "gh"],
			apt: ["gh"], // Needs repo setup first: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
			dnf: ["gh"], // Needs repo setup first
			yum: ["gh"], // Needs repo setup first
			winget: ["GitHub.cli"],
			choco: ["gh"],
		},
	},
	code: {
		name: "code",
		checkCmd: "code",
		checkArgs: ["--version"],
		installGuide: "Install VS Code and run 'Shell Command: Install code command in PATH' from Command Palette.",
		// No automated install for VS Code CLI itself
	},
	pnpm: {
		name: "pnpm",
		checkCmd: "pnpm",
		checkArgs: ["--version"],
		installGuide: "https://pnpm.io/installation",
		installCmd: {
			npm: ["pnpm"], // Install via npm: npm install -g pnpm
			brew: ["install", "pnpm"],
			// Other methods exist but npm/brew cover most cases where node is present
		},
		requires: ["nodejs"], // Requires Node.js/npm
	},
	python: {
		name: "python",
		checkCmd: "python3", // Prefer python3
		checkArgs: ["--version"],
		versionCheck: (v) => checkVersion(v, `>=${ASDF_PYTHON_VERSION}`), // Check >= required version
		asdfPlugin: "python",
		asdfVersion: ASDF_PYTHON_VERSION,
		installGuide: "https://www.python.org/downloads/",
		installCmd: {
			brew: ["install", "python"],
			apt: ["python3"],
			dnf: ["python3"],
			yum: ["python3"],
			winget: ["Python.Python.3"], // Might need specific version?
			choco: ["python"], // Might need specific version?
		},
		requires: ["uv"],
	},
	uv: {
		name: "uv",
		checkCmd: "uv",
		checkArgs: ["--version"],
		installGuide: "https://github.com/astral-sh/uv",
		installCmd: {
			brew: ["install", "uv"],
			pipx: ["uv"], // Preferred pip install method
			pip: ["uv"], // Fallback pip install method
			// curl/sh installer also available: curl -LsSf https://astral.sh/uv/install.sh | sh
		},
		requires: ["python"], // pipx/pip require python
	},
	golang: {
		name: "golang",
		checkCmd: "go",
		checkArgs: ["version"],
		versionCheck: (v) => checkVersion(v, `>=${ASDF_GOLANG_VERSION}`),
		asdfPlugin: "golang",
		asdfVersion: ASDF_GOLANG_VERSION,
		installGuide: "https://go.dev/doc/install",
		installCmd: {
			brew: ["install", "go"],
			apt: ["golang-go"],
			dnf: ["golang"],
			yum: ["golang"],
			winget: ["GoLang.Go"],
			choco: ["golang"],
		},
	},
	rust: {
		name: "rust",
		checkCmd: "rustc",
		checkArgs: ["--version"],
		versionCheck: (v) => checkVersion(v, `>=${ASDF_RUST_VERSION}`),
		asdfPlugin: "rust",
		asdfVersion: ASDF_RUST_VERSION,
		installGuide: "https://www.rust-lang.org/tools/install",
		// Rustup is the preferred install method, often handled by asdf or manually
		// Adding direct package manager installs can conflict with rustup
		// installCmd: { ... }
	},
	java: {
		name: "java",
		checkCmd: "javac",
		checkArgs: ["-version"], // Outputs to stderr
		versionCheck: (v) => checkVersion(v, `>=${JAVA_VERSION_CHECK}`), // Major version check
		asdfPlugin: "java", // asdf java is complex, prefer system package manager
		asdfVersion: "", // Not using asdf version directly
		installGuide: "https://adoptium.net/ (Recommended: Temurin)",
		installCmd: {
			brew: [`openjdk@${JAVA_VERSION_CHECK}`],
			apt: [`openjdk-${JAVA_VERSION_CHECK}-jdk`],
			dnf: [`java-${JAVA_VERSION_CHECK}-openjdk-devel`],
			yum: [`java-${JAVA_VERSION_CHECK}-openjdk-devel`],
			winget: ["EclipseAdoptium.Temurin.17.JDK"], // Example for Temurin 17
			choco: ["openjdk17"], // Example for OpenJDK 17
		},
	},
	// Add nvm, conda, winget, choco, apt, yum, dnf if needed for specific checks/installs
	// ...
}

// --- Core Logic Functions ---

async function checkCoreTools() {
	logStep("Checking Core Tools...")

	// Node.js version check is now handled by setup.sh bootstrapper

	// 1. Git
	await ensureTool("git")

	// 2. VS Code CLI
	await ensureTool("code")

	// 4. pnpm
	await ensureTool("pnpm")

	// 5. GitHub CLI (Optional but Recommended)
	await ensureTool("gh")
	// Check auth status if gh exists
	if (await commandExists("gh")) {
		const authStatus = await getCommandOutput("gh", ["auth", "status"], { reject: false })
		if (authStatus && authStatus.includes("Logged in to github.com")) {
			logSuccess("GitHub CLI is authenticated.")
		} else {
			logWarning("GitHub CLI is not authenticated. You might need to run 'gh auth login'.")
		}
	}
}

async function checkAndInstallLanguages(selectedLangs) {
	const requiredTools = new Set(selectedLangs)
	// Add requirements like 'uv' for 'python'
	selectedLangs.forEach((lang) => {
		DEPENDENCIES[lang]?.requires?.forEach((req) => requiredTools.add(req))
	})

	logStep(`Checking selected languages and dependencies: ${Array.from(requiredTools).join(", ")}`)
	for (const tool of Array.from(requiredTools)) {
		await ensureTool(tool)
	}
}

async function setupPythonVenv() {
	logStep("Setting up Python virtual environment...")
	if (!(await ensureTool("python")) || !(await ensureTool("uv"))) {
		logError("Python or uv is missing, cannot create virtual environment.")
		process.exit(1)
	}

	try {
		await fs.access(PYTHON_VENV_PATH)
		logInfo(`Virtual environment already exists at ${PYTHON_VENV_PATH}. Skipping creation.`)
		// Optionally: Add logic here to check if the venv is valid or needs update
	} catch {
		logInfo(`Creating Python virtual environment at ${PYTHON_VENV_PATH} using uv...`)
		try {
			// Find the python executable path to ensure uv uses the correct one
			const pythonExe = await getCommandOutput(os.platform() === "win32" ? "where" : "which", ["python3"]) || await getCommandOutput(os.platform() === "win32" ? "where" : "which", ["python"])
			if (!pythonExe) {
				throw new Error("Could not find python executable path.")
			}
			logInfo(`Using Python executable: ${pythonExe}`)
			await runCommand("uv", ["venv", PYTHON_VENV_PATH, "--python", pythonExe], { cwd: ROOT_DIR })
			logSuccess(`Virtual environment created at ${PYTHON_VENV_PATH}.`)
			logGuide(`Activate it using: source ${path.relative(ROOT_DIR, PYTHON_VENV_PATH)}/bin/activate (Linux/macOS)`)
			logGuide(`Or: .\\${path.relative(ROOT_DIR, PYTHON_VENV_PATH)}\\Scripts\\activate (Windows)`)
		} catch (venvError) {
			logError(`Failed to create virtual environment: ${venvError.message}`)
			process.exit(1)
		}
	}
}


async function checkRepo() {
	logStep("Checking for evals repository...")
	logInfo(`Target path for external evals repo: ${EVALS_REPO_CLONE_TARGET_PATH}`)

	let repoExists = false
	try {
		await fs.access(path.join(EVALS_REPO_CLONE_TARGET_PATH, ".git"))
		repoExists = true
		logSuccess(`External evals repository found at ${EVALS_REPO_CLONE_TARGET_PATH}`)
	} catch {
		logWarning(`External evals repository not found at ${EVALS_REPO_CLONE_TARGET_PATH}.`)
		repoExists = false
	}

	if (!repoExists) {
		const parentDir = path.dirname(EVALS_REPO_CLONE_TARGET_PATH)
		logInfo(`Ensuring parent directory exists: ${parentDir}`)
		await fs.mkdir(parentDir, { recursive: true })

		let cloned = false
		if (await commandExists("gh")) {
			const { forkRepo } = await prompts({
				type: "confirm",
				name: "forkRepo",
				message: `Do you want to fork the ${EVALS_REPO_UPSTREAM} repository using GitHub CLI? (Recommended for submitting results)`,
				initial: true,
			})
			if (forkRepo === undefined) throw new Error("Prompt cancelled")
			if (forkRepo) {
				try {
					// Fork and clone directly to the target path
					await runCommand("gh", ["repo", "fork", EVALS_REPO_UPSTREAM, "--clone=true", "--", EVALS_REPO_CLONE_TARGET_PATH])
					logSuccess(`Forked and cloned evals repository to ${EVALS_REPO_CLONE_TARGET_PATH}`)
					cloned = true
				} catch (forkError) {
					logError(`GitHub CLI fork/clone failed: ${forkError.message}`)
					logWarning("Attempting a read-only clone instead...")
				}
			}
		}

		if (!cloned) {
			const { cloneRepo } = await prompts({
				type: "confirm",
				name: "cloneRepo",
				message: `Clone the read-only repository from ${EVALS_REPO_URL}?`,
				initial: true,
			})
			if (cloneRepo === undefined) throw new Error("Prompt cancelled")
			if (cloneRepo) {
				try {
					await runCommand("git", ["clone", EVALS_REPO_URL, EVALS_REPO_CLONE_TARGET_PATH])
					logSuccess(`Cloned evals repository to ${EVALS_REPO_CLONE_TARGET_PATH}`)
					cloned = true
				} catch (cloneError) {
					logError(`Git clone failed: ${cloneError.message}`)
					process.exit(1)
				}
			} else {
				logError("Evals repository is required to run evaluations.")
				process.exit(1)
			}
		}
	}
}

async function checkEnvFile() {
	logStep("Setting up .env file...")
	const envPath = path.resolve(ROOT_DIR, ".env")
	const envSamplePath = path.resolve(ROOT_DIR, ".env.sample")
	let openRouterKey = process.env.OPENROUTER_API_KEY || null
	let envContent = ""
	let envExists = false

	try {
		envContent = await fs.readFile(envPath, "utf-8")
		envExists = true
		logSuccess(".env file already exists.")
		const match = envContent.match(/^OPENROUTER_API_KEY=(.*)/m)
		if (match && match[1]?.trim()) {
			openRouterKey = match[1].trim()
			logSuccess("Found valid OPENROUTER_API_KEY in .env file.")
		} else {
			logWarning("OPENROUTER_API_KEY not found or empty in .env file.")
		}
	} catch (err) {
		if (err.code === 'ENOENT') {
			logInfo(".env file not found, copying from .env.sample...")
			try {
				await fs.copyFile(envSamplePath, envPath)
				logSuccess("Copied .env.sample to .env.")
				envContent = await fs.readFile(envPath, "utf-8") // Read the copied content
				envExists = true
			} catch (copyError) {
				logError(`Failed to copy .env.sample: ${copyError}`)
				// Continue without .env, prompt for key later
			}
		} else {
			logError(`Error reading .env file: ${err.message}`)
			// Continue without .env, prompt for key later
		}
	}

	while (!openRouterKey) {
		const { apiKey } = await prompts({
			type: "password",
			name: "apiKey",
			message: "Enter your OpenRouter API key (sk-or-v1-...):",
		})
		if (apiKey === undefined) throw new Error("Prompt cancelled")

		if (apiKey && apiKey.startsWith("sk-or-v1-")) {
			logInfo("🔑 Validating API key...")
			try {
				const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
					headers: { Authorization: `Bearer ${apiKey}` },
				})
				if (!response.ok) throw new Error(`Validation failed: ${response.statusText} (${response.status})`)
				const result = await response.json()
				if (!result?.data) throw new Error("Invalid key format in response.")

				openRouterKey = apiKey
				logSuccess("OpenRouter API key is valid.")

				// Add/Update key in .env file
				if (envExists) {
					let updatedContent
					if (envContent.includes("OPENROUTER_API_KEY=")) {
						updatedContent = envContent.replace(/^OPENROUTER_API_KEY=.*$/m, `OPENROUTER_API_KEY=${openRouterKey}`)
					} else {
						updatedContent = envContent + `\nOPENROUTER_API_KEY=${openRouterKey}\n`
					}
					try {
						await fs.writeFile(envPath, updatedContent)
						logSuccess("Updated OPENROUTER_API_KEY in .env file.")
					} catch (writeError) {
						logError(`Failed to update .env file: ${writeError.message}`)
						logWarning("Please add the key manually.")
					}
				} else {
					// If .env didn't exist and couldn't be created from sample
					logWarning("Could not create or find .env file. API key will not be saved.")
					logGuide("You might need to set the OPENROUTER_API_KEY environment variable manually.")
				}
			} catch (validationError) {
				logError(`API key validation failed: ${validationError.message}. Please try again.`)
			}
		} else if (apiKey) {
			logWarning("Invalid API key format. It should start with 'sk-or-v1-'.")
		} else {
			logError("OpenRouter API key is required to run evaluations.")
			process.exit(1)
		}
	}
}

async function buildExtension() {
	logStep("Building Roo Code extension...")
	const rootRepoDir = path.resolve(ROOT_DIR, "..") // Assumes evals is sibling to main repo dir
	try {
		// Ensure dependencies are installed in the root
		logInfo("Ensuring root dependencies are installed...")
		await runCommand("npm", ["install", "--silent", "--no-audit"], { cwd: rootRepoDir })
		// Run workspace installs
		logInfo("Installing extension & webview dependencies...")
		await runCommand("npm", ["run", "install-extension", "--", "--silent", "--no-audit"], { cwd: rootRepoDir })
		await runCommand("npm", ["run", "install-webview", "--", "--silent", "--no-audit"], { cwd: rootRepoDir })
		// await runCommand("npm", ["run", "install-e2e", "--", "--silent", "--no-audit"], { cwd: rootRepoDir }) // Skip e2e install for setup

		const vsixDestDir = path.join(rootRepoDir, "bin")
		const vsixDest = path.join(vsixDestDir, "roo-code-latest.vsix")
		await fs.mkdir(vsixDestDir, { recursive: true });
		logInfo("Packaging extension...")
		await runCommand("npx", ["vsce", "package", "--out", vsixDest], { cwd: rootRepoDir })
		logSuccess(`Extension built: ${vsixDest}`)
		return vsixDest
	} catch (error) {
		logError(`Failed to build extension: ${error.message}`)
		return null
	}
}

async function installVsix(vsixPath) {
	logStep(`Installing Roo Code extension from ${vsixPath}...`)
	try {
		await ensureTool("code") // Make sure 'code' command exists
		await runCommand("code", ["--install-extension", vsixPath, "--force"])
		logSuccess(`Installed/Updated Roo Code extension from ${vsixPath}.`)
	} catch (error) {
		logWarning(`Failed to install VS Code extension: ${error.message}. Please install manually if needed.`)
	}
}

async function installOtherExtensions() {
	logStep("Installing other required VS Code extensions...")
	await ensureTool("code") // Make sure 'code' command exists
	for (const ext of VSCODE_EXTENSIONS) {
		try {
			await runCommand("code", ["--install-extension", ext, "--force"])
			logSuccess(`Installed/Updated VS Code extension: ${ext}`)
		} catch (error) {
			logWarning(`Failed to install VS Code extension ${ext}: ${error.message}. Please install manually.`)
		}
	}
}

async function syncDatabase() {
	logStep("Setting up database...")
	const dbPath = "/tmp/evals.db" // TODO: Make this configurable or relative?
	let dbExists = false
	try {
		await fs.access(dbPath)
		dbExists = true
		logInfo(`Database file found at ${dbPath}.`)
	} catch {
		logInfo(`Database file not found at ${dbPath}.`)
	}

	try {
		// Ensure DB package dependencies are installed
		await runCommand("pnpm", ["install", "--filter", "@evals/db", "--silent"], { cwd: ROOT_DIR })

		if (!dbExists) {
			logInfo("Attempting to create and sync database schema...")
			await runCommand("pnpm", ["--filter", "@evals/db", "db:push"], { cwd: ROOT_DIR })
			await runCommand("pnpm", ["--filter", "@evals/db", "db:enable-wal"], { cwd: ROOT_DIR })
			logSuccess("Database created and synced.")
		} else {
			logWarning("Existing database file found. Running schema push to apply potential migrations...")
			logInfo("If you encounter issues, you may need to manually manage the database file.")
			await runCommand("pnpm", ["--filter", "@evals/db", "db:push"], { cwd: ROOT_DIR })
			logSuccess("Database schema push executed.")
		}
	} catch (dbError) {
		logError(`Database setup failed: ${dbError}`)
		logGuide(`You might need to run 'pnpm --filter @evals/db db:push' manually in the ${ROOT_DIR} directory.`)
		// Don't exit, maybe user can fix manually
	}
}


// --- Main Setup Function ---
async function main() {
	// Handle prompt cancellations gracefully
	prompts.override({ aborted: true })
	process.on("SIGINT", () => {
		logError("\nOperation cancelled by user (SIGINT).")
		process.exit(130)
	})

	logStep("Starting Roo Code Evals Setup...")

	// 1. Detect Platform & Base Tools (Git, Package Managers)
	await detectPlatformTools()

	// 2. Ensure Core Tools (Correct Node version, Git, VSCode CLI, pnpm, gh)
	await checkCoreTools()

	// 3. Language Selection
	logStep("Select Eval Languages")
	const { selectedLangs } = await prompts({
		type: "multiselect",
		name: "selectedLangs",
		message: "Which languages do you want to run evals for?",
		choices: Object.values(DEPENDENCIES)
			.filter((dep) => ['python', 'golang', 'rust', 'java'].includes(dep.name)) // Filter for selectable languages
			.map((dep) => ({ title: dep.name, value: dep.name, selected: true })),
		hint: "- Space to select. Return to submit",
	})

	if (selectedLangs === undefined) throw new Error("Prompt cancelled")
	if (!selectedLangs || selectedLangs.length === 0) {
		logInfo("No languages selected. Exiting.")
		process.exit(0)
	}
	logInfo(`Selected languages: ${selectedLangs.join(", ")}`)

	// 4. Check and Install Selected Languages & Dependencies (uv)
	await checkAndInstallLanguages(selectedLangs)

	// 5. Project Setup
	logStep("Running pnpm install in evals directory...")
	await runCommand("pnpm", ["install", "--silent"], { cwd: ROOT_DIR })
	logSuccess("Eval dependencies installed.")

	await checkRepo() // Check/clone the external evals repo

	await checkEnvFile() // Check/create .env and get API key

	await syncDatabase() // Check/create/sync the database

	// 6. Setup Python Virtual Environment (if Python selected)
	if (selectedLangs.includes('python')) {
		await setupPythonVenv()
	}

	// 7. VS Code Extension Build & Install
	logStep("Handling Roo Code VS Code Extension...")
	const vsixPath = path.resolve(ROOT_DIR, "..", "bin", "roo-code-latest.vsix")
	let vsixExists = await fs.access(vsixPath).then(() => true).catch(() => false)
	let installedVsixPath = null;

	if (!vsixExists) {
		logWarning("Roo Code extension build (roo-code-latest.vsix) not found.")
		const { buildExt } = await prompts({
			type: "confirm",
			name: "buildExt",
			message: "Build the Roo Code extension now?",
			initial: true,
		})
		if (buildExt === undefined) throw new Error("Prompt cancelled")
		if (buildExt) {
			installedVsixPath = await buildExtension()
		} else {
			logWarning("Skipping extension build. Ensure it's built manually if needed.")
		}
	} else {
		logInfo(`Found existing extension build (${path.basename(vsixPath)}).`)
		const { installExt } = await prompts({
			type: "confirm",
			name: "installExt",
			message: "Install/Update the extension from this build?",
			initial: true, // Default to yes
		})
		if (installExt === undefined) throw new Error("Prompt cancelled")
		if (installExt) {
			installedVsixPath = vsixPath; // Mark it for installation
		} else {
			logInfo("Skipping installation of existing extension build.")
		}
	}

	if (installedVsixPath) {
		await installVsix(installedVsixPath)
	}

	// 8. Install Other VS Code Extensions
	await installOtherExtensions()

	logSuccess("\n🚀 Setup complete!")

	// --- Start Web App ---
	const { startWeb } = await prompts({
		type: "confirm",
		name: "startWeb",
		message: "Start the Evals Web UI now? (Runs 'pnpm web')",
		initial: true,
	})
	if (startWeb === undefined) throw new Error("Prompt cancelled")

	if (startWeb) {
		logInfo("Starting the web UI... Press Ctrl+C to stop it.")
		// Don't await, let it run
		runCommand("pnpm", ["web"], { cwd: ROOT_DIR, stdio: "inherit" }).catch((err) => {
			logError(`Failed to start web UI: ${err.message}`)
		})
	} else {
		logInfo("You can start the web UI later by running 'pnpm web' in the evals directory.")
	}
}

main().catch((error) => {
	logError("\nSetup failed:")
	if (error && typeof error === "object" && error.message?.includes("cancelled")) {
		logError("Operation cancelled by user.")
	} else {
		console.error(error) // Print full error for debugging
	}
	process.exit(1)
})