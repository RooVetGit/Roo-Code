import * as vscode from 'vscode'
import { v4 as uuid } from 'uuid'
import { ClineAsk } from '../../shared/ExtensionMessage'
import { ClineAskResponse } from '../../shared/WebviewMessage'
import { NotificationProvider, NotificationRequest, NotificationResponse, mapClineAskToNotificationType } from './types'

export class NotificationManager {
    private providers: Map<string, NotificationProvider> = new Map()
    private pendingRequests: Map<string, {
        resolve: (response: {response: ClineAskResponse; text?: string}) => void
        timestamp: number
    }> = new Map()

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly outputChannel: vscode.OutputChannel
    ) {}

    async initialize() {
        // Load providers from settings
        const settings = await this.loadSettings()
        
        // Initialize enabled providers
        for (const [providerId, providerSettings] of Object.entries(settings)) {
            if (providerSettings.enabled) {
                try {
                    // Dynamic import of provider
                    const provider = await this.loadProvider(providerId)
                    if (provider) {
                        await provider.initialize()
                        provider.onResponse(this.handleResponse.bind(this))
                        this.providers.set(providerId, provider)
                        this.outputChannel.appendLine(`Initialized ${providerId} notification provider`)
                    }
                } catch (error) {
                    this.outputChannel.appendLine(`Failed to initialize ${providerId} provider: ${error}`)
                }
            }
        }
    }

    async notify(
        type: ClineAsk,
        text: string,
        metadata?: any,
        resolver?: (response: {response: ClineAskResponse; text?: string}) => void
    ) {
        if (this.providers.size === 0) return

        const requestId = uuid()
        if (resolver) {
            this.pendingRequests.set(requestId, {
                resolve: resolver,
                timestamp: Date.now()
            })
        }

        const request: NotificationRequest = {
            type: mapClineAskToNotificationType(type),
            message: text,
            requestId,
            metadata
        }

        for (const provider of this.providers.values()) {
            try {
                await provider.sendNotification(request)
            } catch (error) {
                this.outputChannel.appendLine(`Failed to send notification via provider: ${error}`)
            }
        }

        // Clean up old pending requests
        this.cleanupOldRequests()
    }

    private handleResponse(response: NotificationResponse) {
        const pending = this.pendingRequests.get(response.requestId)
        if (!pending) {
            this.outputChannel.appendLine(`Received response for unknown request: ${response.requestId}`)
            return
        }

        const clineResponse = this.mapResponseToClineAskResponse(response)
        pending.resolve(clineResponse)
        this.pendingRequests.delete(response.requestId)
    }

    private mapResponseToClineAskResponse(response: NotificationResponse): {
        response: ClineAskResponse
        text?: string
    } {
        switch (response.type) {
            case 'approve':
                return { response: 'yesButtonClicked' }
            case 'deny':
                return { response: 'noButtonClicked' }
            case 'text':
                return {
                    response: 'messageResponse',
                    text: response.text
                }
            default:
                throw new Error(`Unknown response type: ${response.type}`)
        }
    }

    private cleanupOldRequests() {
        const now = Date.now()
        const timeout = 1000 * 60 * 60 // 1 hour
        
        for (const [requestId, request] of this.pendingRequests.entries()) {
            if (now - request.timestamp > timeout) {
                this.pendingRequests.delete(requestId)
            }
        }
    }

    private async loadSettings(): Promise<Record<string, { enabled: boolean }>> {
        return this.context.globalState.get('notificationSettings', {})
    }

    private async loadProvider(providerId: string): Promise<NotificationProvider | undefined> {
        try {
            const module = await import(`./providers/${providerId}Provider`)
            const ProviderClass = module.default
            return new ProviderClass(this.context)
        } catch (error) {
            this.outputChannel.appendLine(`Failed to load provider ${providerId}: ${error}`)
            return undefined
        }
    }

    async dispose() {
        for (const provider of this.providers.values()) {
            try {
                await provider.dispose()
            } catch (error) {
                this.outputChannel.appendLine(`Error disposing provider: ${error}`)
            }
        }
        this.providers.clear()
        this.pendingRequests.clear()
    }
}