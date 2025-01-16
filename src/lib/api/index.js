"use strict";
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
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
exports.AnthropicApiClient = exports.OpenRouterApiClient = void 0;
exports.createApiClient = createApiClient;
var sdk_1 = require("@anthropic-ai/sdk");
var axios_1 = require("axios");
var OpenRouterApiClient = /** @class */ (function () {
    function OpenRouterApiClient(config) {
        this.modelId = config.apiModelId;
        this.apiKey = config.apiKey;
    }
    OpenRouterApiClient.prototype.createMessage = function (systemPrompt, history) {
        return __asyncGenerator(this, arguments, function createMessage_1() {
            var messages, response, error_1;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        messages = __spreadArray([
                            { role: "system", content: systemPrompt }
                        ], history.map(function (msg) { return ({
                            role: msg.role,
                            content: Array.isArray(msg.content)
                                ? msg.content.map(function (block) {
                                    if (block.type === 'text')
                                        return block.text;
                                    if (block.type === 'image')
                                        return '[Image]';
                                    return '';
                                }).join('\n')
                                : msg.content
                        }); }), true);
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 8, , 9]);
                        return [4 /*yield*/, __await(axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                                model: this.modelId,
                                messages: messages
                            }, {
                                headers: {
                                    'Authorization': "Bearer ".concat(this.apiKey),
                                    'HTTP-Referer': 'https://github.com/RooVetGit/Roo-Cline',
                                    'X-Title': 'Roo Cline'
                                }
                            }))];
                    case 2:
                        response = _f.sent();
                        if (!(response.data.choices && response.data.choices[0])) return [3 /*break*/, 7];
                        return [4 /*yield*/, __await({
                                type: "usage",
                                inputTokens: (_a = response.data.usage) === null || _a === void 0 ? void 0 : _a.prompt_tokens,
                                outputTokens: (_b = response.data.usage) === null || _b === void 0 ? void 0 : _b.completion_tokens,
                            })];
                    case 3: 
                    // Yield usage information
                    return [4 /*yield*/, _f.sent()];
                    case 4:
                        // Yield usage information
                        _f.sent();
                        return [4 /*yield*/, __await({
                                type: "text",
                                text: response.data.choices[0].message.content,
                            })];
                    case 5: 
                    // Yield the actual content
                    return [4 /*yield*/, _f.sent()];
                    case 6:
                        // Yield the actual content
                        _f.sent();
                        _f.label = 7;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        error_1 = _f.sent();
                        if (axios_1.default.isAxiosError(error_1)) {
                            throw new Error(((_e = (_d = (_c = error_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.message) || error_1.message);
                        }
                        throw error_1;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    OpenRouterApiClient.prototype.getModel = function () {
        return {
            id: this.modelId,
            info: {
                supportsImages: this.modelId.includes("claude-3"),
                supportsComputerUse: true,
                contextWindow: 128000 // Claude 3 Sonnet context window
            }
        };
    };
    return OpenRouterApiClient;
}());
exports.OpenRouterApiClient = OpenRouterApiClient;
var AnthropicApiClient = /** @class */ (function () {
    function AnthropicApiClient(config) {
        this.client = new sdk_1.Anthropic({ apiKey: config.apiKey });
        this.modelId = config.apiModelId;
    }
    AnthropicApiClient.prototype.createMessage = function (systemPrompt, history) {
        return __asyncGenerator(this, arguments, function createMessage_2() {
            var messages, stream, content, _a, stream_1, stream_1_1, chunk, e_1_1;
            var _b, e_1, _c, _d;
            var _e, _f, _g, _h;
            return __generator(this, function (_j) {
                switch (_j.label) {
                    case 0:
                        messages = __spreadArray([
                            { role: "system", content: systemPrompt }
                        ], history, true);
                        return [4 /*yield*/, __await(this.client.messages.create({
                                model: this.modelId,
                                messages: messages,
                                stream: true,
                            }))];
                    case 1:
                        stream = _j.sent();
                        content = "";
                        _j.label = 2;
                    case 2:
                        _j.trys.push([2, 9, 10, 15]);
                        _a = true, stream_1 = __asyncValues(stream);
                        _j.label = 3;
                    case 3: return [4 /*yield*/, __await(stream_1.next())];
                    case 4:
                        if (!(stream_1_1 = _j.sent(), _b = stream_1_1.done, !_b)) return [3 /*break*/, 8];
                        _d = stream_1_1.value;
                        _a = false;
                        chunk = _d;
                        content += ((_e = chunk.delta) === null || _e === void 0 ? void 0 : _e.text) || "";
                        return [4 /*yield*/, __await({
                                type: "text",
                                text: ((_f = chunk.delta) === null || _f === void 0 ? void 0 : _f.text) || "",
                            })];
                    case 5: return [4 /*yield*/, _j.sent()];
                    case 6:
                        _j.sent();
                        _j.label = 7;
                    case 7:
                        _a = true;
                        return [3 /*break*/, 3];
                    case 8: return [3 /*break*/, 15];
                    case 9:
                        e_1_1 = _j.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 15];
                    case 10:
                        _j.trys.push([10, , 13, 14]);
                        if (!(!_a && !_b && (_c = stream_1.return))) return [3 /*break*/, 12];
                        return [4 /*yield*/, __await(_c.call(stream_1))];
                    case 11:
                        _j.sent();
                        _j.label = 12;
                    case 12: return [3 /*break*/, 14];
                    case 13:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 14: return [7 /*endfinally*/];
                    case 15: return [4 /*yield*/, __await({
                            type: "usage",
                            inputTokens: (_g = stream.usage) === null || _g === void 0 ? void 0 : _g.input_tokens,
                            outputTokens: (_h = stream.usage) === null || _h === void 0 ? void 0 : _h.output_tokens,
                        })];
                    case 16: 
                    // Yield final usage information
                    return [4 /*yield*/, _j.sent()];
                    case 17:
                        // Yield final usage information
                        _j.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    AnthropicApiClient.prototype.getModel = function () {
        return {
            id: this.modelId,
            info: {
                supportsImages: this.modelId.includes("claude-3"),
                supportsComputerUse: true,
                contextWindow: 128000
            }
        };
    };
    return AnthropicApiClient;
}());
exports.AnthropicApiClient = AnthropicApiClient;
function createApiClient(config) {
    switch (config.apiProvider) {
        case "openrouter":
            return new OpenRouterApiClient(config);
        case "anthropic":
            return new AnthropicApiClient(config);
        default:
            throw new Error("Unsupported API provider: ".concat(config.apiProvider));
    }
}
