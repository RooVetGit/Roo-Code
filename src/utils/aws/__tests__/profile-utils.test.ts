import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs/promises"
import os from "os"
import { logger } from "../../../utils/logging"
import {
	isRemoteSSH,
	doesAwsProfileExist,
	showRemoteProfileError,
	getDetailedRemoteProfileErrorMessage,
} from "../profile-utils"

// Mock VS Code API
jest.mock("vscode", () => ({
	env: {
		remoteName: undefined,
	},
	window: {
		showErrorMessage: jest.fn(),
	},
}))

// Mock fs/promises
jest.mock("fs/promises", () => ({
	access: jest.fn(),
	readFile: jest.fn(),
}))

// Mock os
jest.mock("os", () => ({
	homedir: jest.fn().mockReturnValue("/mock/home"),
}))

// Mock logger
jest.mock("../../../utils/logging", () => ({
	logger: {
		warn: jest.fn(),
		error: jest.fn(),
		debug: jest.fn(),
	},
}))

describe("AWS Profile Utilities", () => {
	beforeEach(() => {
		jest.clearAllMocks()
	})

	describe("isRemoteSSH", () => {
		it("should return false when not in a remote context", () => {
			// Mock not in remote context
			;(vscode.env.remoteName as any) = undefined

			expect(isRemoteSSH()).toBe(false)
		})

		it("should return false when in a non-SSH remote context", () => {
			// Mock in a non-SSH remote context (e.g., DevContainer)
			;(vscode.env.remoteName as any) = "devcontainer"

			expect(isRemoteSSH()).toBe(false)
		})

		it("should return true when in an SSH remote context", () => {
			// Mock in an SSH remote context
			;(vscode.env.remoteName as any) = "ssh-remote"

			expect(isRemoteSSH()).toBe(true)
		})
	})

	describe("doesAwsProfileExist", () => {
		it("should return true when profile exists in credentials file", async () => {
			// Mock file access and content
			;(fs.access as jest.Mock).mockResolvedValue(undefined)
			;(fs.readFile as jest.Mock).mockResolvedValue("[default]\naws_access_key_id=AKIAIOSFODNN7EXAMPLE")

			const result = await doesAwsProfileExist("default")

			expect(result).toBe(true)
			expect(fs.access).toHaveBeenCalledWith(path.join("/mock/home", ".aws", "credentials"))
			expect(fs.readFile).toHaveBeenCalledWith(path.join("/mock/home", ".aws", "credentials"), "utf8")
		})

		it("should return true when profile exists in config file", async () => {
			// Mock credentials file doesn't exist but config file does
			;(fs.access as jest.Mock).mockImplementation((filePath) => {
				if (filePath.includes("credentials")) {
					return Promise.reject(new Error("File not found"))
				}
				return Promise.resolve(undefined)
			})

			// Mock config file content
			;(fs.readFile as jest.Mock).mockImplementation((filePath) => {
				if (filePath.includes("config")) {
					return Promise.resolve("[profile default]\nregion=us-west-2")
				}
				return Promise.reject(new Error("File not found"))
			})

			const result = await doesAwsProfileExist("default")

			expect(result).toBe(true)
			expect(fs.access).toHaveBeenCalledWith(path.join("/mock/home", ".aws", "credentials"))
			expect(fs.readFile).toHaveBeenCalledWith(path.join("/mock/home", ".aws", "config"), "utf8")
		})

		it("should return false when profile doesn't exist in either file", async () => {
			// Mock both files exist but don't contain the profile
			;(fs.access as jest.Mock).mockResolvedValue(undefined)
			;(fs.readFile as jest.Mock).mockResolvedValue(
				"[some-other-profile]\naws_access_key_id=AKIAIOSFODNN7EXAMPLE",
			)

			const result = await doesAwsProfileExist("non-existent-profile")

			expect(result).toBe(false)
		})

		it("should return false when AWS files don't exist", async () => {
			// Mock files don't exist
			;(fs.access as jest.Mock).mockRejectedValue(new Error("File not found"))

			const result = await doesAwsProfileExist("default")

			expect(result).toBe(false)
		})

		it("should handle errors gracefully", async () => {
			// Mock unexpected error
			;(fs.access as jest.Mock).mockResolvedValue(undefined)
			;(fs.readFile as jest.Mock).mockRejectedValue(new Error("Permission denied"))

			const result = await doesAwsProfileExist("default")

			expect(result).toBe(false)
			expect(logger.debug).toHaveBeenCalled()
		})
	})

	describe("showRemoteProfileError", () => {
		it("should log a warning and show an error message", () => {
			showRemoteProfileError("test-profile")

			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining('AWS Profile "test-profile" not found'),
				expect.objectContaining({
					ctx: "bedrock",
					profile: "test-profile",
					isRemoteSSH: true,
				}),
			)

			expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
				expect.stringContaining('AWS Profile "test-profile" not found'),
			)
		})
	})

	describe("getDetailedRemoteProfileErrorMessage", () => {
		it("should return a detailed error message with the profile name", () => {
			const message = getDetailedRemoteProfileErrorMessage("test-profile")

			expect(message).toContain('Could not find AWS profile "test-profile"')
			expect(message).toContain("Options to resolve this issue")
			expect(message).toContain("Create the AWS profile on the remote machine")
			expect(message).toContain("Switch to using direct AWS credentials")
			expect(message).toContain("Copy your AWS credentials from your local machine")
		})
	})
})
