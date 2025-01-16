#!/usr/bin/env node
"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv = require("dotenv");
var child_process_1 = require("child_process");
var lib_1 = require("./lib");
dotenv.config();
var CliToolExecutor = /** @class */ (function (_super) {
    __extends(CliToolExecutor, _super);
    function CliToolExecutor() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    CliToolExecutor.prototype.executeCommand = function (command) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, new Promise(function (resolve) {
                        var process = (0, child_process_1.spawn)(command, [], {
                            shell: true,
                            cwd: _this.getCurrentWorkingDirectory()
                        });
                        var output = '';
                        var error = '';
                        process.stdout.on('data', function (data) {
                            output += data.toString();
                            console.log(data.toString());
                        });
                        process.stderr.on('data', function (data) {
                            error += data.toString();
                            console.error(data.toString());
                        });
                        process.on('close', function (code) {
                            if (code !== 0) {
                                resolve([true, 'Command failed with code ' + code + '\n' + error]);
                            }
                            else {
                                resolve([false, output]);
                            }
                        });
                    })];
            });
        });
    };
    CliToolExecutor.prototype.getCurrentWorkingDirectory = function () {
        return process.cwd();
    };
    return CliToolExecutor;
}(lib_1.BaseToolExecutor));
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var args, task, apiKey, apiConfiguration, cwd, toolExecutor, contextProvider, messageParser, apiClient, envDetails, toolDocs, systemPromptParts, systemPrompt, history_1, _a, _b, _c, chunk, toolUse, _d, error, result, e_1_1, error_1;
        var _e, e_1, _f, _g;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    args = process.argv.slice(2);
                    task = args[0];
                    if (!task) {
                        console.error('Usage: cline "My Task" [--tools]');
                        process.exit(1);
                    }
                    apiKey = process.env.OPENROUTER_API_KEY;
                    if (!apiKey) {
                        console.error('Error: OPENROUTER_API_KEY environment variable is required');
                        process.exit(1);
                    }
                    apiConfiguration = {
                        apiKey: apiKey,
                        apiModelId: 'anthropic/claude-3-sonnet-20240229',
                        apiProvider: 'openrouter',
                    };
                    cwd = process.cwd();
                    toolExecutor = new CliToolExecutor(cwd);
                    contextProvider = new lib_1.CliContextProvider(cwd);
                    messageParser = new lib_1.MessageParser(lib_1.AVAILABLE_TOOLS);
                    apiClient = (0, lib_1.createApiClient)(apiConfiguration);
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 19, , 20]);
                    return [4 /*yield*/, contextProvider.getEnvironmentDetails(true)];
                case 2:
                    envDetails = _h.sent();
                    toolDocs = lib_1.AVAILABLE_TOOLS.map(function (tool) {
                        var params = Object.entries(tool.parameters)
                            .map(function (_a) {
                            var name = _a[0], param = _a[1];
                            return '- ' + name + ': (' + (param.required ? 'required' : 'optional') + ') ' + param.description;
                        })
                            .join('\n');
                        return '## ' + tool.name + '\nDescription: ' + tool.description + '\nParameters:\n' + params;
                    }).join('\n\n');
                    systemPromptParts = [
                        'You are Cline, a highly skilled software engineer.',
                        '',
                        'TOOLS',
                        '',
                        'You have access to the following tools that must be used with XML tags:',
                        '',
                        toolDocs,
                        '',
                        'RULES',
                        '',
                        '1. Use one tool at a time',
                        '2. Wait for tool execution results before proceeding',
                        '3. Handle errors appropriately',
                        '4. Document your changes',
                        '',
                        'TASK',
                        '',
                        task
                    ];
                    systemPrompt = systemPromptParts.join('\n');
                    history_1 = [
                        { role: 'user', content: "<task>".concat(task, "</task><environment_details>").concat(envDetails, "</environment_details>") }
                    ];
                    _h.label = 3;
                case 3:
                    _h.trys.push([3, 12, 13, 18]);
                    _a = true, _b = __asyncValues(apiClient.createMessage(systemPrompt, history_1));
                    _h.label = 4;
                case 4: return [4 /*yield*/, _b.next()];
                case 5:
                    if (!(_c = _h.sent(), _e = _c.done, !_e)) return [3 /*break*/, 11];
                    _g = _c.value;
                    _a = false;
                    chunk = _g;
                    if (!(chunk.type === 'text' && chunk.text)) return [3 /*break*/, 9];
                    toolUse = messageParser.parseMessage(chunk.text);
                    if (!toolUse) return [3 /*break*/, 7];
                    return [4 /*yield*/, toolExecutor.executeCommand(toolUse.command)];
                case 6:
                    _d = _h.sent(), error = _d[0], result = _d[1];
                    history_1.push({ role: 'assistant', content: chunk.text }, { role: 'user', content: "[".concat(toolUse.name, "] Result: ").concat(result) });
                    return [3 /*break*/, 8];
                case 7:
                    console.log(chunk.text);
                    _h.label = 8;
                case 8: return [3 /*break*/, 10];
                case 9:
                    if (chunk.type === 'usage') {
                        // Log usage metrics if needed
                        // console.log('Usage:', chunk);
                    }
                    _h.label = 10;
                case 10:
                    _a = true;
                    return [3 /*break*/, 4];
                case 11: return [3 /*break*/, 18];
                case 12:
                    e_1_1 = _h.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 18];
                case 13:
                    _h.trys.push([13, , 16, 17]);
                    if (!(!_a && !_e && (_f = _b.return))) return [3 /*break*/, 15];
                    return [4 /*yield*/, _f.call(_b)];
                case 14:
                    _h.sent();
                    _h.label = 15;
                case 15: return [3 /*break*/, 17];
                case 16:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 17: return [7 /*endfinally*/];
                case 18: return [3 /*break*/, 20];
                case 19:
                    error_1 = _h.sent();
                    console.error('Error:', error_1.message);
                    process.exit(1);
                    return [3 /*break*/, 20];
                case 20: return [2 /*return*/];
            }
        });
    });
}
main().catch(function (error) {
    console.error('Fatal error:', error);
    process.exit(1);
});
