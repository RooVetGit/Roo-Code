import { Anthropic } from "@anthropic-ai/sdk";
import { ApiClient } from "../types";
import axios from "axios";

export interface ApiConfiguration {
    apiKey: string;
    apiModelId: string;
    apiProvider: "anthropic" | "openrouter";
}

export class OpenRouterApiClient implements ApiClient {
    private modelId: string;
    private apiKey: string;

    constructor(config: ApiConfiguration) {
        this.modelId = config.apiModelId;
        this.apiKey = config.apiKey;
    }

    async *createMessage(
        systemPrompt: string,
        history: Anthropic.MessageParam[]
    ): AsyncIterableIterator<{
        type: "text" | "usage";
        text?: string;
        inputTokens?: number;
        outputTokens?: number;
        cacheWriteTokens?: number;
        cacheReadTokens?: number;
        totalCost?: number;
    }> {
        const messages = [
            { role: "system", content: systemPrompt },
            ...history.map(msg => ({
                role: msg.role,
                content: Array.isArray(msg.content) 
                    ? msg.content.map(block => {
                        if (block.type === 'text') return block.text;
                        if (block.type === 'image') return '[Image]';
                        return '';
                    }).join('\n')
                    : msg.content
            }))
        ];

        try {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: this.modelId,
                    messages
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'HTTP-Referer': 'https://github.com/RooVetGit/Roo-Cline',
                        'X-Title': 'Roo Cline'
                    }
                }
            );

            if (response.data.choices && response.data.choices[0]) {
                // Yield usage information
                yield {
                    type: "usage",
                    inputTokens: response.data.usage?.prompt_tokens,
                    outputTokens: response.data.usage?.completion_tokens,
                };

                // Yield the actual content
                yield {
                    type: "text",
                    text: response.data.choices[0].message.content,
                };
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(error.response?.data?.error?.message || error.message);
            }
            throw error;
        }
    }

    getModel() {
        return {
            id: this.modelId,
            info: {
                supportsImages: this.modelId.includes("claude-3"),
                supportsComputerUse: true,
                contextWindow: 128000 // Claude 3 Sonnet context window
            }
        };
    }
}

export class AnthropicApiClient implements ApiClient {
    private client: Anthropic;
    private modelId: string;

    constructor(config: ApiConfiguration) {
        this.client = new Anthropic({ apiKey: config.apiKey });
        this.modelId = config.apiModelId;
    }

    async *createMessage(
        systemPrompt: string,
        history: Anthropic.MessageParam[]
    ): AsyncIterableIterator<{
        type: "text" | "usage";
        text?: string;
        inputTokens?: number;
        outputTokens?: number;
        cacheWriteTokens?: number;
        cacheReadTokens?: number;
        totalCost?: number;
    }> {
        const messages = [
            { role: "system", content: systemPrompt },
            ...history
        ];

        const stream = await this.client.messages.create({
            model: this.modelId,
            messages,
            stream: true,
        });

        let content = "";
        for await (const chunk of stream) {
            content += chunk.delta?.text || "";
            yield {
                type: "text",
                text: chunk.delta?.text || "",
            };
        }

        // Yield final usage information
        yield {
            type: "usage",
            inputTokens: stream.usage?.input_tokens,
            outputTokens: stream.usage?.output_tokens,
        };
    }

    getModel() {
        return {
            id: this.modelId,
            info: {
                supportsImages: this.modelId.includes("claude-3"),
                supportsComputerUse: true,
                contextWindow: 128000
            }
        };
    }
}

export function createApiClient(config: ApiConfiguration): ApiClient {
    switch (config.apiProvider) {
        case "openrouter":
            return new OpenRouterApiClient(config);
        case "anthropic":
            return new AnthropicApiClient(config);
        default:
            throw new Error(`Unsupported API provider: ${config.apiProvider}`);
    }
}