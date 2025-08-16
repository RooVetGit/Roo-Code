import axios from "axios"
import { promises as fs } from "fs"
import { join } from "path"
import { homedir } from "os"
import { ModelRecord } from "../../../shared/api"
import {
	GITHUB_ACCESS_TOKEN_URL,
	GITHUB_API_KEY_URL,
	GITHUB_CLIENT_ID,
	GITHUB_COPILOT_API_BASE,
	GITHUB_DEVICE_CODE_URL,
} from "@roo-code/types"

interface DeviceCodeResponse {
	device_code: string
	user_code: string
	verification_uri: string
	expires_in: number
	interval: number
}

interface AccessTokenResponse {
	access_token?: string
	error?: string
	error_description?: string
}

interface CopilotTokenResponse {
	token: string
	expires_at: number
	refresh_in?: number
	endpoints?: {
		api?: string
	}
}

interface StoredTokenData {
	access_token: string
	api_key?: string
	api_key_expires_at?: number
	api_base?: string
}

interface DeviceCodeInfo {
	device_code: string
	user_code: string
	verification_uri: string
	expires_in: number
	interval: number
}

export class CopilotAuthenticator {
	private tokenDir: string
	private tokenFile: string
	private static instance: CopilotAuthenticator | null = null
	private deviceCodeCallback?: (info: DeviceCodeInfo) => void
	private authTimeoutCallback?: (error: string) => void

	private constructor() {
		// Store tokens in user's home directory
		this.tokenDir = join(homedir(), ".roo-code", "copilot")
		this.tokenFile = join(this.tokenDir, "tokens.json")
	}

	public static getInstance() {
		if (CopilotAuthenticator.instance === null) {
			CopilotAuthenticator.instance = new CopilotAuthenticator()
		}
		return CopilotAuthenticator.instance
	}

	/**
	 * Set callback for device code information
	 */
	setDeviceCodeCallback(callback: (info: DeviceCodeInfo) => void) {
		this.deviceCodeCallback = callback
	}

	/**
	 * Set callback for authentication timeout
	 */
	setAuthTimeoutCallback(callback: (error: string) => void) {
		this.authTimeoutCallback = callback
	}

	/**
	 * Get a valid API key for Copilot
	 */
	async getApiKey(): Promise<{ apiKey: string; apiBase?: string }> {
		try {
			const stored = await this.loadStoredTokens()

			// Check if we have a valid API key
			if (stored.api_key && stored.api_key_expires_at) {
				const now = Math.floor(Date.now() / 1000)
				if (stored.api_key_expires_at > now + 60) {
					// 60 second buffer
					return {
						apiKey: stored.api_key,
						apiBase: stored.api_base,
					}
				}
			}

			// If we have an access token, try to refresh the API key
			if (stored.access_token) {
				try {
					const copilotToken = await this.refreshApiKey(stored.access_token)
					await this.saveTokens({
						access_token: stored.access_token,
						api_key: copilotToken.token,
						api_key_expires_at: copilotToken.expires_at,
						api_base: copilotToken.endpoints?.api,
					})
					return {
						apiKey: copilotToken.token,
						apiBase: copilotToken.endpoints?.api,
					}
				} catch (error) {
					console.warn("Failed to refresh API key, starting new authentication:", error)
					// Fall through to device code flow
				}
			}

			// Start device code flow
			const accessToken = await this.authenticateWithDeviceCode()
			const copilotToken = await this.refreshApiKey(accessToken)

			await this.saveTokens({
				access_token: accessToken,
				api_key: copilotToken.token,
				api_key_expires_at: copilotToken.expires_at,
				api_base: copilotToken.endpoints?.api,
			})

			return {
				apiKey: copilotToken.token,
				apiBase: copilotToken.endpoints?.api,
			}
		} catch (error) {
			throw new Error(`Failed to authenticate with Copilot: ${error}`)
		}
	}

	/**
	 * Start device code authentication flow
	 */
	private async authenticateWithDeviceCode(): Promise<string> {
		// Step 1: Get device code
		const deviceResponse = await axios.post<DeviceCodeResponse>(
			GITHUB_DEVICE_CODE_URL,
			{
				client_id: GITHUB_CLIENT_ID,
				scope: "read:user",
			},
			{
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					"User-Agent": "GitHubCopilotChat/0.26.7",
				},
			},
		)

		const deviceData = deviceResponse.data

		// Step 2: Show user code to user via callback
		if (this.deviceCodeCallback) {
			this.deviceCodeCallback({
				device_code: deviceData.device_code,
				user_code: deviceData.user_code,
				verification_uri: deviceData.verification_uri,
				expires_in: deviceData.expires_in,
				interval: deviceData.interval || 5,
			})
		}

		// Step 3: Poll for access token
		return this.pollForAccessToken(deviceData.device_code, deviceData.interval || 5)
	}

	/**
	 * Poll GitHub for access token after user authorization
	 */
	private async pollForAccessToken(deviceCode: string, interval: number): Promise<string> {
		const maxAttempts = 60 // 5 minutes maximum

		for (let attempt = 0; attempt < maxAttempts; attempt++) {
			await new Promise((resolve) => setTimeout(resolve, interval * 1000))

			try {
				const response = await axios.post<AccessTokenResponse>(
					GITHUB_ACCESS_TOKEN_URL,
					{
						client_id: GITHUB_CLIENT_ID,
						device_code: deviceCode,
						grant_type: "urn:ietf:params:oauth:grant-type:device_code",
					},
					{
						headers: {
							Accept: "application/json",
							"Content-Type": "application/json",
							"User-Agent": "GitHubCopilotChat/0.26.7",
						},
					},
				)

				const data = response.data

				if (data.access_token) {
					console.log("✅ Authentication successful!")
					return data.access_token
				}

				if (data.error === "authorization_pending") {
					continue // Keep polling
				}

				if (data.error === "slow_down") {
					interval = Math.min(interval * 2, 10) // Increase interval
					continue
				}

				if (data.error) {
					const errorMsg = `GitHub OAuth error: ${data.error} - ${data.error_description}`
					if (this.authTimeoutCallback) {
						this.authTimeoutCallback(errorMsg)
					}
					throw new Error(errorMsg)
				}
			} catch (error) {
				if (axios.isAxiosError(error) && error.response?.status === 400) {
					// Continue polling on 400 errors (authorization_pending)
					continue
				}
				if (this.authTimeoutCallback) {
					this.authTimeoutCallback(error instanceof Error ? error.message : "Authentication failed")
				}
				throw error
			}
		}

		const timeoutError = "Authentication timed out. Please try again."
		if (this.authTimeoutCallback) {
			this.authTimeoutCallback(timeoutError)
		}
		throw new Error(timeoutError)
	}

	/**
	 * Exchange access token for Copilot API key
	 */
	private async refreshApiKey(accessToken: string): Promise<CopilotTokenResponse> {
		const response = await axios.get<CopilotTokenResponse>(GITHUB_API_KEY_URL, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${accessToken}`,
				"User-Agent": "GitHubCopilotChat/0.26.7",
				"Editor-Version": "vscode/1.85.1",
				"Editor-Plugin-Version": "copilot-chat/0.26.7",
			},
		})

		return response.data
	}

	/**
	 * Load stored tokens from file
	 */
	private async loadStoredTokens(): Promise<Partial<StoredTokenData>> {
		try {
			await this.ensureTokenDir()
			const data = await fs.readFile(this.tokenFile, "utf-8")
			return JSON.parse(data)
		} catch (error) {
			return {}
		}
	}

	/**
	 * Save tokens to file
	 */
	private async saveTokens(tokens: StoredTokenData): Promise<void> {
		await this.ensureTokenDir()
		await fs.writeFile(this.tokenFile, JSON.stringify(tokens, null, 2))
	}

	/**
	 * Ensure token directory exists
	 */
	private async ensureTokenDir(): Promise<void> {
		try {
			await fs.mkdir(this.tokenDir, { recursive: true })
		} catch (error) {
			// Directory might already exist
		}
	}

	/**
	 * Clear stored authentication data
	 */
	async clearAuth(): Promise<void> {
		try {
			await fs.unlink(this.tokenFile)
			console.log("🗑️ Cleared Copilot authentication data")
		} catch (error) {
			// File might not exist
		}
	}

	/**
	 * Check if user is authenticated
	 */
	async isAuthenticated(): Promise<boolean> {
		try {
			const stored = await this.loadStoredTokens()
			return !!stored.access_token
		} catch (error) {
			return false
		}
	}
}

/**
 * Get available Copilot models using device code authentication
 */
export async function getCopilotModels(): Promise<ModelRecord> {
	try {
		const authenticator = CopilotAuthenticator.getInstance()
		const { apiKey, apiBase } = await authenticator.getApiKey()

		const baseURL = apiBase || GITHUB_COPILOT_API_BASE
		const modelsUrl = `${baseURL.replace(/\/$/, "")}/models`

		const response = await fetch(modelsUrl, {
			headers: {
				Authorization: `Bearer ${apiKey}`,
				Accept: "application/json",
				"User-Agent": "GithubCopilot/1.155.0",
				"editor-version": "vscode/1.85.1",
				"editor-plugin-version": "copilot/1.155.0",
			},
		})

		if (!response.ok) {
			console.warn("Failed to fetch Copilot models:", response.statusText)
			throw new Error(`Failed to fetch Copilot models: ${response.statusText}`)
		}

		const data = await response.json()
		const result = {} as ModelRecord
		for (const model of data.data) {
			if (model.model_picker_enabled !== true) {
				continue
			}
			result[model.id] = {
				maxTokens: model?.capabilities?.limits?.max_output_tokens,
				maxThinkingTokens: model?.capabilities?.supports?.max_thinking_budget,
				contextWindow: model?.capabilities?.limits?.max_context_window_tokens,
				// supportsImages: !!model?.capabilities?.supports?.vision,
				supportsImages: false,
				supportsComputerUse: false,
				supportsPromptCache: true,
				supportsVerbosity: false,
				// supportsReasoningBudget: !!model?.capabilities?.supports?.max_thinking_budget,
				supportsReasoningBudget: false,
				requiredReasoningBudget: false,
				supportsReasoningEffort: false,
				supportedParameters: model?.capabilities?.supports?.max_thinking_budget ? ["reasoning"] : [],
				inputPrice: 0,
				outputPrice: 0,
				cacheWritesPrice: 0,
				cacheReadsPrice: 0,
				description: model.name,
				reasoningEffort: undefined,
				minTokensPerCachePoint: undefined,
				maxCachePoints: undefined,
				cachableFields: undefined,
				tiers: undefined,
			}
		}
		return result
	} catch (error) {
		console.error("Failed to fetch Copilot models:", error)
		throw new Error(`Failed to fetch Copilot models: ${error instanceof Error ? error.message : String(error)}`)
	}
}
