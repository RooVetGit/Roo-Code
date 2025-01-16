import { Tool } from '../types';

export interface ParsedTool {
    name: string;
    params: Record<string, string>;
    partial: boolean;
}

export class MessageParser {
    constructor(private tools: Tool[]) {}

    parseToolUse(text: string): ParsedTool | null {
        // Handle various XML formats:
        // 1. <write_to_file>...</write_to_file>
        // 2. <write_to_file path="..." content="..." line_count="...">
        // 3. <tool:write_to_file path="..." line_count="...">...</tool:write_to_file>
        
        // Try matching tool:prefix format first
        let toolMatch = text.match(/<tool:([a-z_]+)(?:\s+([^>]*))?>([\s\S]*?)<\/tool:\1>/);
        
        // If no match, try standard format
        if (!toolMatch) {
            toolMatch = text.match(/<([a-z_]+)(?:\s+([^>]*))?>([\s\S]*?)<\/\1>/);
        }
        
        if (!toolMatch) return null;

        const toolName = toolMatch[1];
        const inlineParams = toolMatch[2];
        const content = toolMatch[3];

        // Verify this is a valid tool
        const tool = this.tools.find(t => t.name === toolName);
        if (!tool) return null;

        const params: Record<string, string> = {};

        // Parse inline parameters if they exist
        if (inlineParams) {
            const inlineMatches = inlineParams.matchAll(/([a-z_]+)="([^"]*)"/g);
            for (const match of Array.from(inlineMatches)) {
                params[match[1]] = match[2];
            }
        }

        // For write_to_file, use the content between tags if not specified in params
        if (toolName === 'write_to_file' && !params.content && content) {
            params.content = content.trim();
        }

        // Parse nested parameters if they exist
        const paramMatches = content.matchAll(/<([a-z_]+)>([\s\S]*?)<\/\1>/g);
        for (const match of Array.from(paramMatches)) {
            params[match[1]] = match[2].trim();
        }

        // Check if all required parameters are present and complete
        const partial = Object.entries(tool.parameters)
            .filter(([_, param]) => param.required)
            .some(([name]) => !params[name]);

        return {
            name: toolName,
            params,
            partial
        };
    }

    validateToolParams(toolName: string, params: Record<string, string>): string | null {
        const tool = this.tools.find(t => t.name === toolName);
        if (!tool) return `Unknown tool: ${toolName}`;

        // Check required parameters
        for (const [paramName, paramInfo] of Object.entries(tool.parameters)) {
            if (paramInfo.required && !params[paramName]) {
                return `Missing required parameter: ${paramName}`;
            }
        }

        return null;
    }

    removePartialXmlTag(content: string): string {
        // Remove end substrings of incomplete XML tags
        const lastOpenBracketIndex = content.lastIndexOf("<");
        if (lastOpenBracketIndex !== -1) {
            const possibleTag = content.slice(lastOpenBracketIndex);
            const hasCloseBracket = possibleTag.includes(">");
            if (!hasCloseBracket) {
                let tagContent: string;
                if (possibleTag.startsWith("</")) {
                    tagContent = possibleTag.slice(2).trim();
                } else {
                    tagContent = possibleTag.slice(1).trim();
                }
                const isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent);
                const isOpeningOrClosing = possibleTag === "<" || possibleTag === "</";
                if (isOpeningOrClosing || isLikelyTagName) {
                    content = content.slice(0, lastOpenBracketIndex).trim();
                }
            }
        }
        return content;
    }

    removeThinkingTags(content: string): string {
        // Remove <thinking> tags and their content
        content = content.replace(/<thinking>\s?/g, "");
        content = content.replace(/\s?<\/thinking>/g, "");
        return content;
    }
}