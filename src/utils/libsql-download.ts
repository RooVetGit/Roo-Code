import * as fs from "fs"
import * as fsp from "fs/promises"
import axios from "axios"
import * as tar from "tar"
import { familySync } from "detect-libc"
import { OutputChannel } from "vscode"
import * as path from "path"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function currentTarget(): Promise<string> {
	let target: string | null = null
	let os = null

	switch (process.platform) {
		case "android":
			switch (process.arch) {
				case "arm":
					return "android-arm-eabi"
				case "arm64":
					return "android-arm64"
			}
			os = "Android"
			break

		case "win32":
			switch (process.arch) {
				case "x64":
					return "win32-x64-msvc"
				case "arm64":
					return "win32-arm64-msvc"
				case "ia32":
					return "win32-ia32-msvc"
			}
			os = "Windows"
			break

		case "darwin":
			switch (process.arch) {
				case "x64":
					return "darwin-x64"
				case "arm64":
					return "darwin-arm64"
			}
			os = "macOS"
			break

		case "linux": {
			const libc = familySync()

			switch (process.arch) {
				case "x64":
				case "arm64":
					target = libc === "glibc" ? `linux-${process.arch}-gnu` : `linux-${process.arch}-musl`
					if (libc === "glibc" && target.endsWith("-musl")) {
						target = target.replace("-musl", "-gnu")
					}
					break
				case "arm":
					target = libc === "musl" ? "linux-arm-musleabihf" : "linux-arm-gnueabihf"
					break
			}

			os = "Linux"
			break
		}

		case "freebsd":
			if (process.arch === "x64") {
				return "freebsd-x64"
			}
			os = "FreeBSD"
			break
	}

	if (!target && os) {
		throw new Error(`Unsupported ${os} architecture: ${process.arch}`)
	}

	if (!target) {
		throw new Error(`Unsupported system: ${process.platform}`)
	}

	return target
}

async function downloadWithRetry(
	url: string,
	tempFilePath: string,
	outputChannel: OutputChannel,
	maxRetries: number = 3,
	initialBackoff: number = 2000,
) {
	let lastError: any

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			outputChannel.appendLine(`Download attempt ${attempt}/${maxRetries}: ${url}`)

			const response = await axios({
				method: "get",
				url: url,
				responseType: "stream",
				timeout: 30000,
			})

			await new Promise<void>((resolve, reject) => {
				const writer = fs.createWriteStream(tempFilePath)
				response.data.pipe(writer)
				writer.on("finish", resolve)
				writer.on("error", reject)
			})

			outputChannel.appendLine(`Successfully downloaded ${tempFilePath} on attempt ${attempt}`)
			return
		} catch (error) {
			lastError = error
			outputChannel.appendLine(`Download attempt ${attempt} failed: ${error.message || error}`)

			if (attempt < maxRetries) {
				const backoffTime = initialBackoff * Math.pow(2, attempt - 1)
				outputChannel.appendLine(`Retrying in ${backoffTime}ms...`)
				await sleep(backoffTime)
			}
		}
	}

	throw new Error(`Download failed after ${maxRetries} attempts. Last error: ${lastError.message || lastError}`)
}

export async function downloadLibsqlNative(extensionDir: string, outputChannel: OutputChannel) {
	try {
		const target = await currentTarget()
		const versionFilePath = path.join(extensionDir, "dist", "libsql-version.txt")
		let version: string
		try {
			version = (await fsp.readFile(versionFilePath, "utf8")).trim()
			outputChannel.appendLine(`Dynamically loaded libsql version: ${version}`)
		} catch (error) {
			throw new Error(`Could not read libsql version file: ${error.message || error}`)
		}
		const downloadUrl = `https://github.com/tursodatabase/libsql-js/releases/download/v${version}/libsql-${target}-${version}.tgz`
		const targetDir = path.join(extensionDir, "dist", "node_modules", "@libsql", target)
		const expectedModulePath = path.join(targetDir, "index.node")
		const tempFilePath = path.join(extensionDir, "dist", `libsql-${target}-${version}.tgz`)

		outputChannel.appendLine(`Detected target: ${target}`)

		try {
			await fsp.access(expectedModulePath)
			outputChannel.appendLine(`Native module already exists at: ${expectedModulePath}`)
			return
		} catch {
			outputChannel.appendLine(`Native module not found, proceeding with download...`)
		}

		outputChannel.appendLine(`Attempting to download from: ${downloadUrl}`)
		outputChannel.appendLine(`Target directory for extraction: ${targetDir}`)

		await fsp.mkdir(targetDir, { recursive: true })

		await downloadWithRetry(downloadUrl, tempFilePath, outputChannel)

		outputChannel.appendLine(`Downloaded ${tempFilePath}`)

		await tar.extract({
			file: tempFilePath,
			cwd: targetDir,
			strip: 1,
		})

		outputChannel.appendLine(`Extracted to ${targetDir}`)

		try {
			const extractedFiles = await fsp.readdir(targetDir, { recursive: true })
			outputChannel.appendLine(`Extracted files: ${JSON.stringify(extractedFiles)}`)
		} catch (listError) {
			outputChannel.appendLine(`Could not list extracted files: ${listError}`)
		}

		await fsp.unlink(tempFilePath)
		outputChannel.appendLine(`Cleaned up temporary file: ${tempFilePath}`)

		try {
			await fsp.access(expectedModulePath)
			outputChannel.appendLine(`Native module verified at: ${expectedModulePath}`)
		} catch {
			outputChannel.appendLine(`Warning: Native module not found at expected path: ${expectedModulePath}`)
			console.warn("Native module not found at expected path: ", expectedModulePath)
		}
	} catch (error) {
		outputChannel.appendLine(`Error during libsql native module preload: ${error.message || error}`)
		console.error("Error during libsql native module preload: ", error)
	}
}
