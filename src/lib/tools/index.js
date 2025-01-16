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
exports.BaseToolExecutor = exports.AVAILABLE_TOOLS = void 0;
var fs = require("fs/promises");
var path = require("path");
var search_1 = require("../services/search");
exports.AVAILABLE_TOOLS = [
    {
        name: 'write_to_file',
        description: 'Write content to a file at the specified path',
        parameters: {
            path: {
                required: true,
                description: 'The path of the file to write to'
            },
            content: {
                required: true,
                description: 'The content to write to the file'
            },
            line_count: {
                required: true,
                description: 'The number of lines in the file'
            }
        }
    },
    {
        name: 'read_file',
        description: 'Read the contents of a file',
        parameters: {
            path: {
                required: true,
                description: 'The path of the file to read'
            }
        }
    },
    {
        name: 'list_files',
        description: 'List files in a directory',
        parameters: {
            path: {
                required: true,
                description: 'The path of the directory to list'
            },
            recursive: {
                required: false,
                description: 'Whether to list files recursively'
            }
        }
    },
    {
        name: 'search_files',
        description: 'Search files using regex',
        parameters: {
            path: {
                required: true,
                description: 'The path to search in'
            },
            regex: {
                required: true,
                description: 'The regex pattern to search for'
            },
            file_pattern: {
                required: false,
                description: 'Optional file pattern to filter files'
            }
        }
    }
];
var BaseToolExecutor = /** @class */ (function () {
    function BaseToolExecutor(cwd) {
        this.cwd = cwd;
    }
    BaseToolExecutor.prototype.executeCommand = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                throw new Error('executeCommand must be implemented by platform');
            });
        });
    };
    BaseToolExecutor.prototype.writeFile = function (filePath, content, lineCount) {
        return __awaiter(this, void 0, void 0, function () {
            var absolutePath, fileExists, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        absolutePath = this.resolvePath(filePath);
                        return [4 /*yield*/, this.fileExists(absolutePath)];
                    case 1:
                        fileExists = _a.sent();
                        // Create directories if they don't exist
                        return [4 /*yield*/, fs.mkdir(path.dirname(absolutePath), { recursive: true })];
                    case 2:
                        // Create directories if they don't exist
                        _a.sent();
                        return [4 /*yield*/, fs.writeFile(absolutePath, content)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, [false, "File successfully ".concat(fileExists ? 'updated' : 'created', " at ").concat(filePath)]];
                    case 4:
                        error_1 = _a.sent();
                        return [2 /*return*/, [true, "Error writing file: ".concat(error_1.message)]];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    BaseToolExecutor.prototype.readFile = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var absolutePath, content, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        absolutePath = this.resolvePath(filePath);
                        return [4 /*yield*/, fs.readFile(absolutePath, 'utf-8')];
                    case 1:
                        content = _a.sent();
                        return [2 /*return*/, [false, content]];
                    case 2:
                        error_2 = _a.sent();
                        return [2 /*return*/, [true, "Error reading file: ".concat(error_2.message)]];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    BaseToolExecutor.prototype.listFiles = function (dirPath_1) {
        return __awaiter(this, arguments, void 0, function (dirPath, recursive) {
            var absolutePath, files, error_3;
            if (recursive === void 0) { recursive = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        absolutePath = this.resolvePath(dirPath);
                        return [4 /*yield*/, this.readDirRecursive(absolutePath, recursive)];
                    case 1:
                        files = _a.sent();
                        return [2 /*return*/, [false, files.join('\n')]];
                    case 2:
                        error_3 = _a.sent();
                        return [2 /*return*/, [true, "Error listing files: ".concat(error_3.message)]];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    BaseToolExecutor.prototype.searchFiles = function (dirPath, regex, filePattern) {
        return __awaiter(this, void 0, void 0, function () {
            var absolutePath, results, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        absolutePath = this.resolvePath(dirPath);
                        return [4 /*yield*/, (0, search_1.searchFiles)(this.cwd, absolutePath, regex, filePattern)];
                    case 1:
                        results = _a.sent();
                        return [2 /*return*/, [false, results]];
                    case 2:
                        error_4 = _a.sent();
                        return [2 /*return*/, [true, "Error searching files: ".concat(error_4.message)]];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    BaseToolExecutor.prototype.readDirRecursive = function (dir, recursive) {
        return __awaiter(this, void 0, void 0, function () {
            var dirents, files, _i, dirents_1, dirent, res, _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, fs.readdir(dir, { withFileTypes: true })];
                    case 1:
                        dirents = _d.sent();
                        files = [];
                        _i = 0, dirents_1 = dirents;
                        _d.label = 2;
                    case 2:
                        if (!(_i < dirents_1.length)) return [3 /*break*/, 6];
                        dirent = dirents_1[_i];
                        res = path.resolve(dir, dirent.name);
                        if (!(dirent.isDirectory() && recursive)) return [3 /*break*/, 4];
                        _b = (_a = files.push).apply;
                        _c = [files];
                        return [4 /*yield*/, this.readDirRecursive(res, recursive)];
                    case 3:
                        _b.apply(_a, _c.concat([_d.sent()]));
                        return [3 /*break*/, 5];
                    case 4:
                        files.push(path.relative(this.cwd, res));
                        _d.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 2];
                    case 6: return [2 /*return*/, files];
                }
            });
        });
    };
    BaseToolExecutor.prototype.resolvePath = function (relativePath) {
        return path.resolve(this.cwd, relativePath);
    };
    BaseToolExecutor.prototype.fileExists = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fs.access(filePath)];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return BaseToolExecutor;
}());
exports.BaseToolExecutor = BaseToolExecutor;
