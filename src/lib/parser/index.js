"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageParser = void 0;
var MessageParser = /** @class */ (function () {
    function MessageParser(tools) {
        this.tools = tools;
    }
    MessageParser.prototype.parseToolUse = function (text) {
        // Handle various XML formats:
        // 1. <write_to_file>...</write_to_file>
        // 2. <write_to_file path="..." content="..." line_count="...">
        // 3. <tool:write_to_file path="..." line_count="...">...</tool:write_to_file>
        // Try matching tool:prefix format first
        var toolMatch = text.match(/<tool:([a-z_]+)(?:\s+([^>]*))?>([\s\S]*?)<\/tool:\1>/);
        // If no match, try standard format
        if (!toolMatch) {
            toolMatch = text.match(/<([a-z_]+)(?:\s+([^>]*))?>([\s\S]*?)<\/\1>/);
        }
        if (!toolMatch)
            return null;
        var toolName = toolMatch[1];
        var inlineParams = toolMatch[2];
        var content = toolMatch[3];
        // Verify this is a valid tool
        var tool = this.tools.find(function (t) { return t.name === toolName; });
        if (!tool)
            return null;
        var params = {};
        // Parse inline parameters if they exist
        if (inlineParams) {
            var inlineMatches = inlineParams.matchAll(/([a-z_]+)="([^"]*)"/g);
            for (var _i = 0, _a = Array.from(inlineMatches); _i < _a.length; _i++) {
                var match = _a[_i];
                params[match[1]] = match[2];
            }
        }
        // For write_to_file, use the content between tags if not specified in params
        if (toolName === 'write_to_file' && !params.content && content) {
            params.content = content.trim();
        }
        // Parse nested parameters if they exist
        var paramMatches = content.matchAll(/<([a-z_]+)>([\s\S]*?)<\/\1>/g);
        for (var _b = 0, _c = Array.from(paramMatches); _b < _c.length; _b++) {
            var match = _c[_b];
            params[match[1]] = match[2].trim();
        }
        // Check if all required parameters are present and complete
        var partial = Object.entries(tool.parameters)
            .filter(function (_a) {
            var _ = _a[0], param = _a[1];
            return param.required;
        })
            .some(function (_a) {
            var name = _a[0];
            return !params[name];
        });
        return {
            name: toolName,
            params: params,
            partial: partial
        };
    };
    MessageParser.prototype.validateToolParams = function (toolName, params) {
        var tool = this.tools.find(function (t) { return t.name === toolName; });
        if (!tool)
            return "Unknown tool: ".concat(toolName);
        // Check required parameters
        for (var _i = 0, _a = Object.entries(tool.parameters); _i < _a.length; _i++) {
            var _b = _a[_i], paramName = _b[0], paramInfo = _b[1];
            if (paramInfo.required && !params[paramName]) {
                return "Missing required parameter: ".concat(paramName);
            }
        }
        return null;
    };
    MessageParser.prototype.removePartialXmlTag = function (content) {
        // Remove end substrings of incomplete XML tags
        var lastOpenBracketIndex = content.lastIndexOf("<");
        if (lastOpenBracketIndex !== -1) {
            var possibleTag = content.slice(lastOpenBracketIndex);
            var hasCloseBracket = possibleTag.includes(">");
            if (!hasCloseBracket) {
                var tagContent = void 0;
                if (possibleTag.startsWith("</")) {
                    tagContent = possibleTag.slice(2).trim();
                }
                else {
                    tagContent = possibleTag.slice(1).trim();
                }
                var isLikelyTagName = /^[a-zA-Z_]+$/.test(tagContent);
                var isOpeningOrClosing = possibleTag === "<" || possibleTag === "</";
                if (isOpeningOrClosing || isLikelyTagName) {
                    content = content.slice(0, lastOpenBracketIndex).trim();
                }
            }
        }
        return content;
    };
    MessageParser.prototype.removeThinkingTags = function (content) {
        // Remove <thinking> tags and their content
        content = content.replace(/<thinking>\s?/g, "");
        content = content.replace(/\s?<\/thinking>/g, "");
        return content;
    };
    return MessageParser;
}());
exports.MessageParser = MessageParser;
