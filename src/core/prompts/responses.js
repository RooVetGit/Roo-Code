"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatResponse = void 0;
var path = require("path");
var diff = require("diff");
exports.formatResponse = {
    toolDenied: function () { return "The user denied this operation."; },
    toolDeniedWithFeedback: function (feedback) {
        return "The user denied this operation and provided the following feedback:\n<feedback>\n".concat(feedback, "\n</feedback>");
    },
    toolError: function (error) { return "The tool execution failed with the following error:\n<error>\n".concat(error, "\n</error>"); },
    noToolsUsed: function () {
        return "[ERROR] You did not use a tool in your previous response! Please retry with a tool use.\n\n".concat(toolUseInstructionsReminder, "\n\n# Next Steps\n\nIf you have completed the user's task, use the attempt_completion tool. \nIf you require additional information from the user, use the ask_followup_question tool. \nOtherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. \n(This is an automated message, so do not respond to it conversationally.)");
    },
    tooManyMistakes: function (feedback) {
        return "You seem to be having trouble proceeding. The user has provided the following feedback to help guide you:\n<feedback>\n".concat(feedback, "\n</feedback>");
    },
    missingToolParameterError: function (paramName) {
        return "Missing value for required parameter '".concat(paramName, "'. Please retry with complete response.\n\n").concat(toolUseInstructionsReminder);
    },
    invalidMcpToolArgumentError: function (serverName, toolName) {
        return "Invalid JSON argument used with ".concat(serverName, " for ").concat(toolName, ". Please retry with a properly formatted JSON argument.");
    },
    toolResult: function (text, images) {
        if (images && images.length > 0) {
            var textBlock = { type: "text", text: text };
            var imageBlocks = formatImagesIntoBlocks(images);
            // Placing images after text leads to better results
            return __spreadArray([textBlock], imageBlocks, true);
        }
        else {
            return text;
        }
    },
    imageBlocks: function (images) {
        return formatImagesIntoBlocks(images);
    },
    formatFilesList: function (absolutePath, files, didHitLimit) {
        var sorted = files
            .map(function (file) {
            // convert absolute path to relative path
            var relativePath = path.relative(absolutePath, file).toPosix();
            return file.endsWith("/") ? relativePath + "/" : relativePath;
        })
            // Sort so files are listed under their respective directories to make it clear what files are children of what directories. Since we build file list top down, even if file list is truncated it will show directories that cline can then explore further.
            .sort(function (a, b) {
            var aParts = a.split("/"); // only works if we use toPosix first
            var bParts = b.split("/");
            for (var i = 0; i < Math.min(aParts.length, bParts.length); i++) {
                if (aParts[i] !== bParts[i]) {
                    // If one is a directory and the other isn't at this level, sort the directory first
                    if (i + 1 === aParts.length && i + 1 < bParts.length) {
                        return -1;
                    }
                    if (i + 1 === bParts.length && i + 1 < aParts.length) {
                        return 1;
                    }
                    // Otherwise, sort alphabetically
                    return aParts[i].localeCompare(bParts[i], undefined, { numeric: true, sensitivity: "base" });
                }
            }
            // If all parts are the same up to the length of the shorter path,
            // the shorter one comes first
            return aParts.length - bParts.length;
        });
        if (didHitLimit) {
            return "".concat(sorted.join("\n"), "\n\n(File list truncated. Use list_files on specific subdirectories if you need to explore further.)");
        }
        else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
            return "No files found.";
        }
        else {
            return sorted.join("\n");
        }
    },
    createPrettyPatch: function (filename, oldStr, newStr) {
        if (filename === void 0) { filename = "file"; }
        // strings cannot be undefined or diff throws exception
        var patch = diff.createPatch(filename.toPosix(), oldStr || "", newStr || "");
        var lines = patch.split("\n");
        var prettyPatchLines = lines.slice(4);
        return prettyPatchLines.join("\n");
    },
};
// to avoid circular dependency
var formatImagesIntoBlocks = function (images) {
    return images
        ? images.map(function (dataUrl) {
            // data:image/png;base64,base64string
            var _a = dataUrl.split(","), rest = _a[0], base64 = _a[1];
            var mimeType = rest.split(":")[1].split(";")[0];
            return {
                type: "image",
                source: { type: "base64", media_type: mimeType, data: base64 },
            };
        })
        : [];
};
var toolUseInstructionsReminder = "# Reminder: Instructions for Tool Use\n\nTool uses are formatted using XML-style tags. The tool name is enclosed in opening and closing tags, and each parameter is similarly enclosed within its own set of tags. Here's the structure:\n\n<tool_name>\n<parameter1_name>value1</parameter1_name>\n<parameter2_name>value2</parameter2_name>\n...\n</tool_name>\n\nFor example:\n\n<attempt_completion>\n<result>\nI have completed the task...\n</result>\n</attempt_completion>\n\nAlways adhere to this format for all tool uses to ensure proper parsing and execution.";
