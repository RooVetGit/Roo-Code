"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arePathsEqual = arePathsEqual;
exports.getReadablePath = getReadablePath;
var path = require("path");
var os_1 = require("os");
/*
The Node.js 'path' module resolves and normalizes paths differently depending on the platform:
- On Windows, it uses backslashes (\) as the default path separator.
- On POSIX-compliant systems (Linux, macOS), it uses forward slashes (/) as the default path separator.

While modules like 'upath' can be used to normalize paths to use forward slashes consistently,
this can create inconsistencies when interfacing with other modules (like vscode.fs) that use
backslashes on Windows.

Our approach:
1. We present paths with forward slashes to the AI and user for consistency.
2. We use the 'arePathsEqual' function for safe path comparisons.
3. Internally, Node.js gracefully handles both backslashes and forward slashes.

This strategy ensures consistent path presentation while leveraging Node.js's built-in
path handling capabilities across different platforms.

Note: When interacting with the file system or VS Code APIs, we still use the native path module
to ensure correct behavior on all platforms. The toPosixPath and arePathsEqual functions are
primarily used for presentation and comparison purposes, not for actual file system operations.

Observations:
- Macos isn't so flexible with mixed separators, whereas windows can handle both. ("Node.js does automatically handle path separators on Windows, converting forward slashes to backslashes as needed. However, on macOS and other Unix-like systems, the path separator is always a forward slash (/), and backslashes are treated as regular characters.")
*/
function toPosixPath(p) {
    // Extended-Length Paths in Windows start with "\\?\" to allow longer paths and bypass usual parsing. If detected, we return the path unmodified to maintain functionality, as altering these paths could break their special syntax.
    var isExtendedLengthPath = p.startsWith("\\\\?\\");
    if (isExtendedLengthPath) {
        return p;
    }
    return p.replace(/\\/g, "/");
}
String.prototype.toPosix = function () {
    return toPosixPath(this);
};
// Safe path comparison that works across different platforms
function arePathsEqual(path1, path2) {
    if (!path1 && !path2) {
        return true;
    }
    if (!path1 || !path2) {
        return false;
    }
    path1 = normalizePath(path1);
    path2 = normalizePath(path2);
    if (process.platform === "win32") {
        return path1.toLowerCase() === path2.toLowerCase();
    }
    return path1 === path2;
}
function normalizePath(p) {
    // normalize resolve ./.. segments, removes duplicate slashes, and standardizes path separators
    var normalized = path.normalize(p);
    // however it doesn't remove trailing slashes
    // remove trailing slash, except for root paths
    if (normalized.length > 1 && (normalized.endsWith("/") || normalized.endsWith("\\"))) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}
function getReadablePath(cwd, relPath) {
    relPath = relPath || "";
    // path.resolve is flexible in that it will resolve relative paths like '../../' to the cwd and even ignore the cwd if the relPath is actually an absolute path
    var absolutePath = path.resolve(cwd, relPath);
    if (arePathsEqual(cwd, path.join(os_1.default.homedir(), "Desktop"))) {
        // User opened vscode without a workspace, so cwd is the Desktop. Show the full absolute path to keep the user aware of where files are being created
        return absolutePath.toPosix();
    }
    if (arePathsEqual(path.normalize(absolutePath), path.normalize(cwd))) {
        return path.basename(absolutePath).toPosix();
    }
    else {
        // show the relative path to the cwd
        var normalizedRelPath = path.relative(cwd, absolutePath);
        if (absolutePath.includes(cwd)) {
            return normalizedRelPath.toPosix();
        }
        else {
            // we are outside the cwd, so show the absolute path (useful for when cline passes in '../../' for example)
            return absolutePath.toPosix();
        }
    }
}
