"use strict"
var __createBinding =
	(this && this.__createBinding) ||
	(Object.create
		? function (o, m, k, k2) {
				if (k2 === undefined) k2 = k
				var desc = Object.getOwnPropertyDescriptor(m, k)
				if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
					desc = {
						enumerable: true,
						get: function () {
							return m[k]
						},
					}
				}
				Object.defineProperty(o, k2, desc)
			}
		: function (o, m, k, k2) {
				if (k2 === undefined) k2 = k
				o[k2] = m[k]
			})
var __setModuleDefault =
	(this && this.__setModuleDefault) ||
	(Object.create
		? function (o, v) {
				Object.defineProperty(o, "default", { enumerable: true, value: v })
			}
		: function (o, v) {
				o["default"] = v
			})
var __importStar =
	(this && this.__importStar) ||
	(function () {
		var ownKeys = function (o) {
			ownKeys =
				Object.getOwnPropertyNames ||
				function (o) {
					var ar = []
					for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k
					return ar
				}
			return ownKeys(o)
		}
		return function (mod) {
			if (mod && mod.__esModule) return mod
			var result = {}
			if (mod != null)
				for (var k = ownKeys(mod), i = 0; i < k.length; i++)
					if (k[i] !== "default") __createBinding(result, mod, k[i])
			__setModuleDefault(result, mod)
			return result
		}
	})()
Object.defineProperty(exports, "__esModule", { value: true })
exports.getWebSocketConfigPath = getWebSocketConfigPath
exports.readWebSocketConfig = readWebSocketConfig
const fs = __importStar(require("fs/promises"))
const os = __importStar(require("os"))
const path = __importStar(require("path"))
/**
 * Get the path to the WebSocket configuration file
 * @returns The path to the WebSocket configuration file
 */
function getWebSocketConfigPath() {
	return path.join(os.tmpdir(), "roocode-websocket-config.json")
}
/**
 * Read WebSocket server configuration from the temp directory
 * @returns A promise that resolves with the WebSocket server configuration
 * @throws Error if the configuration file does not exist or is invalid
 */
async function readWebSocketConfig() {
	try {
		const configPath = getWebSocketConfigPath()
		try {
			await fs.access(configPath)
		} catch (error) {
			throw new Error("WebSocket configuration file not found. Is the RooCode extension running?")
		}
		const configData = await fs.readFile(configPath, "utf-8")
		const config = JSON.parse(configData)
		if (!config.port || !config.token) {
			throw new Error("Invalid WebSocket configuration")
		}
		return config
	} catch (error) {
		console.error(`Error reading WebSocket config: ${error instanceof Error ? error.message : String(error)}`)
		throw error
	}
}
