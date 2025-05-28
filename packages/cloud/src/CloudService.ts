import * as vscode from "vscode"
import EventEmitter from "events"

import type { CloudUserInfo, TelemetryEvent } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { AuthService, type AuthServiceEvents } from "./AuthService"
import { SettingsService } from "./SettingsService"
import { TelemetryClient } from "./TelemetryClient"

export type CloudServiceEvents = AuthServiceEvents

export interface CloudServiceCallbacks {
	onUserInfoChanged?: (userInfo: CloudUserInfo | undefined) => void
	onSettingsChanged?: () => void
}

export class CloudService extends EventEmitter<CloudServiceEvents> {
	private static _instance: CloudService | null = null

	private context: vscode.ExtensionContext
	private callbacks: CloudServiceCallbacks
	private authService: AuthService | null = null
	private settingsService: SettingsService | null = null
	private telemetryClient: TelemetryClient | null = null
	private isInitialized = false

	private constructor(context: vscode.ExtensionContext, callbacks: CloudServiceCallbacks) {
		super()
		this.context = context
		this.callbacks = callbacks
	}

	public async initialize(): Promise<void> {
		if (this.isInitialized) {
			return
		}

		try {
			this.authService = await AuthService.createInstance(this.context, (userInfo) => {
				this.callbacks.onUserInfoChanged?.(userInfo)
			})

			this.authService.on("active-session", (args) => this.emit("active-session", args))
			this.authService.on("logged-out", (args) => this.emit("logged-out", args))

			this.settingsService = await SettingsService.createInstance(this.context, () =>
				this.callbacks.onSettingsChanged?.(),
			)

			this.telemetryClient = new TelemetryClient(this.authService)

			try {
				TelemetryService.instance.register(this.telemetryClient)
			} catch (error) {
				console.warn("[CloudService] Failed to register TelemetryClient:", error)
			}

			this.isInitialized = true
		} catch (error) {
			console.error("[CloudService] Failed to initialize:", error)
			throw new Error(`Failed to initialize CloudService: ${error}`)
		}
	}

	// AuthService

	public async login(): Promise<void> {
		this.ensureInitialized()
		return this.authService!.login()
	}

	public async logout(): Promise<void> {
		this.ensureInitialized()
		return this.authService!.logout((userInfo) => this.callbacks.onUserInfoChanged?.(userInfo))
	}

	public isAuthenticated(): boolean {
		this.ensureInitialized()
		return this.authService!.isAuthenticated()
	}

	public hasActiveSession(): boolean {
		this.ensureInitialized()
		return this.authService!.hasActiveSession()
	}

	public async getUserInfo(): Promise<CloudUserInfo | undefined> {
		this.ensureInitialized()
		return this.authService!.getUserInfo()
	}

	public getAuthState(): string {
		this.ensureInitialized()
		return this.authService!.getState()
	}

	public getSessionToken(): string | undefined {
		this.ensureInitialized()
		return this.authService!.getSessionToken()
	}

	public async handleAuthCallback(code: string | null, state: string | null): Promise<void> {
		this.ensureInitialized()
		return this.authService!.handleCallback(code, state, (userInfo) => this.callbacks.onUserInfoChanged?.(userInfo))
	}

	// SettingsService

	public getOrganizationSettings() {
		this.ensureInitialized()
		return this.settingsService!.getSettings()
	}

	public getAllowList() {
		this.ensureInitialized()
		return this.settingsService!.getAllowList()
	}

	// TelemetryClient

	public captureEvent(event: TelemetryEvent): void {
		this.ensureInitialized()
		this.telemetryClient!.capture(event)
	}

	// Lifecycle

	public dispose(): void {
		if (this.settingsService) {
			this.settingsService.dispose()
		}

		this.removeAllListeners()
		this.isInitialized = false
	}

	private ensureInitialized(): void {
		if (!this.isInitialized || !this.authService || !this.settingsService || !this.telemetryClient) {
			throw new Error("CloudService not initialized.")
		}
	}

	static get instance(): CloudService {
		if (!this._instance) {
			throw new Error("CloudService not initialized")
		}

		return this._instance
	}

	static async createInstance(
		context: vscode.ExtensionContext,
		callbacks: CloudServiceCallbacks = {},
	): Promise<CloudService> {
		if (this._instance) {
			throw new Error("CloudService instance already created")
		}

		this._instance = new CloudService(context, callbacks)
		await this._instance.initialize()
		return this._instance
	}

	static hasInstance(): boolean {
		return this._instance !== null && this._instance.isInitialized
	}

	static resetInstance(): void {
		if (this._instance) {
			this._instance.dispose()
			this._instance = null
		}
	}

	static isEnabled(): boolean {
		return !!this._instance?.isAuthenticated()
	}
}
