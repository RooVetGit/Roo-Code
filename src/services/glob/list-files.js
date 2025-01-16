"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFiles = listFiles;
var globby_1 = require("globby");
var os_1 = require("os");
var path = require("path");
var path_1 = require("../../utils/path");
function listFiles(dirPath, recursive, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var absolutePath, root, isRoot, homeDir, isHomeDir, dirsToIgnore, options, files, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    absolutePath = path.resolve(dirPath);
                    root = process.platform === "win32" ? path.parse(absolutePath).root : "/";
                    isRoot = (0, path_1.arePathsEqual)(absolutePath, root);
                    if (isRoot) {
                        return [2 /*return*/, [[root], false]];
                    }
                    homeDir = os_1.default.homedir();
                    isHomeDir = (0, path_1.arePathsEqual)(absolutePath, homeDir);
                    if (isHomeDir) {
                        return [2 /*return*/, [[homeDir], false]];
                    }
                    dirsToIgnore = [
                        "node_modules",
                        "__pycache__",
                        "env",
                        "venv",
                        "target/dependency",
                        "build/dependencies",
                        "dist",
                        "out",
                        "bundle",
                        "vendor",
                        "tmp",
                        "temp",
                        "deps",
                        "pkg",
                        "Pods",
                        ".*", // '!**/.*' excludes hidden directories, while '!**/.*/**' excludes only their contents. This way we are at least aware of the existence of hidden directories.
                    ].map(function (dir) { return "**/".concat(dir, "/**"); });
                    options = {
                        cwd: dirPath,
                        dot: true, // do not ignore hidden files/directories
                        absolute: true,
                        markDirectories: true, // Append a / on any directories matched (/ is used on windows as well, so dont use path.sep)
                        gitignore: recursive, // globby ignores any files that are gitignored
                        ignore: recursive ? dirsToIgnore : undefined, // just in case there is no gitignore, we ignore sensible defaults
                        onlyFiles: false, // true by default, false means it will list directories on their own too
                    };
                    if (!recursive) return [3 /*break*/, 2];
                    return [4 /*yield*/, globbyLevelByLevel(limit, options)];
                case 1:
                    _a = _b.sent();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, (0, globby_1.globby)("*", options)];
                case 3:
                    _a = (_b.sent()).slice(0, limit);
                    _b.label = 4;
                case 4:
                    files = _a;
                    return [2 /*return*/, [files, files.length >= limit]];
            }
        });
    });
}
/*
Breadth-first traversal of directory structure level by level up to a limit:
   - Queue-based approach ensures proper breadth-first traversal
   - Processes directory patterns level by level
   - Captures a representative sample of the directory structure up to the limit
   - Minimizes risk of missing deeply nested files

- Notes:
   - Relies on globby to mark directories with /
   - Potential for loops if symbolic links reference back to parent (we could use followSymlinks: false but that may not be ideal for some projects and it's pointless if they're not using symlinks wrong)
   - Timeout mechanism prevents infinite loops
*/
function globbyLevelByLevel(limit, options) {
    return __awaiter(this, void 0, void 0, function () {
        var results, queue, globbingProcess, timeoutPromise, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    results = new Set();
                    queue = ["*"];
                    globbingProcess = function () { return __awaiter(_this, void 0, void 0, function () {
                        var pattern, filesAtLevel, _i, filesAtLevel_1, file;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!(queue.length > 0 && results.size < limit)) return [3 /*break*/, 2];
                                    pattern = queue.shift();
                                    return [4 /*yield*/, (0, globby_1.globby)(pattern, options)];
                                case 1:
                                    filesAtLevel = _a.sent();
                                    for (_i = 0, filesAtLevel_1 = filesAtLevel; _i < filesAtLevel_1.length; _i++) {
                                        file = filesAtLevel_1[_i];
                                        if (results.size >= limit) {
                                            break;
                                        }
                                        results.add(file);
                                        if (file.endsWith("/")) {
                                            queue.push("".concat(file, "*"));
                                        }
                                    }
                                    return [3 /*break*/, 0];
                                case 2: return [2 /*return*/, Array.from(results).slice(0, limit)];
                            }
                        });
                    }); };
                    timeoutPromise = new Promise(function (_, reject) {
                        setTimeout(function () { return reject(new Error("Globbing timeout")); }, 10000);
                    });
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, Promise.race([globbingProcess(), timeoutPromise])];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_1 = _a.sent();
                    console.warn("Globbing timed out, returning partial results");
                    return [2 /*return*/, Array.from(results)];
                case 4: return [2 /*return*/];
            }
        });
    });
}
