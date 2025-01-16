import { Anthropic } from "@anthropic-ai/sdk";

export type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>;
export type UserContent = Array<
    Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>;

export interface Tool {
    name: string;
    description: string;
    parameters: {
        [key: string]: {
            required: boolean;
            description: string;
        };
    };
}

export interface ToolExecutor {
    executeCommand(command: string): Promise<[boolean, ToolResponse]>;
    writeFile(path: string, content: string, lineCount: number): Promise<[boolean, ToolResponse]>;
    readFile(path: string): Promise<[boolean, ToolResponse]>;
    listFiles(path: string, recursive?: boolean): Promise<[boolean, ToolResponse]>;
    searchFiles(path: string, regex: string, filePattern?: string): Promise<[boolean, ToolResponse]>;
    listCodeDefinitions(path: string): Promise<[boolean, ToolResponse]>;
}

export interface ApiClient {
    createMessage(systemPrompt: string, history: Anthropic.MessageParam[]): AsyncIterableIterator<{
        type: "text" | "usage";
        text?: string;
        inputTokens?: number;
        outputTokens?: number;
        cacheWriteTokens?: number;
        cacheReadTokens?: number;
        totalCost?: number;
    }>;
    getModel(): {
        id: string;
        info: {
            supportsImages?: boolean;
            supportsComputerUse?: boolean;
            contextWindow?: number;
        };
    };
}

export interface ContextProvider {
    getEnvironmentDetails(includeFileDetails?: boolean): Promise<string>;
    getCurrentWorkingDirectory(): string;
    getState(): Promise<{
        mode?: string;
        mcpEnabled?: boolean;
        alwaysApproveResubmit?: boolean;
        requestDelaySeconds?: number;
        browserViewportSize?: { width: number; height: number };
        preferredLanguage?: string;
        customPrompts?: Record<string, string>;
    }>;
}

export interface TaskExecutor {
    startTask(task: string, images?: string[]): Promise<void>;
    abortTask(): void;
    onMessage?(message: string): void;
    onError?(error: Error): void;
    onComplete?(result: string): void;
}

export interface GlobalStorageUri {
    fsPath: string;
}