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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VsCodeContextProvider = exports.CliContextProvider = exports.BaseContextProvider = void 0;
var path = require("path");
var list_files_1 = require("../../services/glob/list-files");
var responses_1 = require("../../core/prompts/responses");
var path_1 = require("../../utils/path");
var os_1 = require("os");
var BaseContextProvider = /** @class */ (function () {
    function BaseContextProvider(cwd, state) {
        if (state === void 0) { state = {}; }
        this.cwd = cwd;
        this.state = state;
    }
    BaseContextProvider.prototype.getCurrentWorkingDirectory = function () {
        return this.cwd;
    };
    BaseContextProvider.prototype.getState = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                return [2 /*return*/, {
                        mode: (_a = this.state.mode) !== null && _a !== void 0 ? _a : 'code',
                        mcpEnabled: (_b = this.state.mcpEnabled) !== null && _b !== void 0 ? _b : true,
                        alwaysApproveResubmit: (_c = this.state.alwaysApproveResubmit) !== null && _c !== void 0 ? _c : false,
                        requestDelaySeconds: (_d = this.state.requestDelaySeconds) !== null && _d !== void 0 ? _d : 5,
                        browserViewportSize: (_e = this.state.browserViewportSize) !== null && _e !== void 0 ? _e : { width: 900, height: 600 },
                        preferredLanguage: this.state.preferredLanguage,
                        customPrompts: (_f = this.state.customPrompts) !== null && _f !== void 0 ? _f : {},
                    }];
            });
        });
    };
    BaseContextProvider.prototype.getEnvironmentDetails = function () {
        return __awaiter(this, arguments, void 0, function (includeFileDetails) {
            var details, now, formatter, timeZone, timeZoneOffset, timeZoneOffsetStr, mode, isDesktop, _a, files, didHitLimit, result;
            if (includeFileDetails === void 0) { includeFileDetails = false; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        details = "";
                        now = new Date();
                        formatter = new Intl.DateTimeFormat(undefined, {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric',
                            hour12: true
                        });
                        timeZone = formatter.resolvedOptions().timeZone;
                        timeZoneOffset = -now.getTimezoneOffset() / 60;
                        timeZoneOffsetStr = "".concat(timeZoneOffset >= 0 ? '+' : '').concat(timeZoneOffset, ":00");
                        details += "\n\n# Current Time\n".concat(formatter.format(now), " (").concat(timeZone, ", UTC").concat(timeZoneOffsetStr, ")");
                        return [4 /*yield*/, this.getState()];
                    case 1:
                        mode = (_b.sent()).mode;
                        details += "\n\n# Current Mode\n".concat(mode);
                        if (!includeFileDetails) return [3 /*break*/, 4];
                        details += "\n\n# Current Working Directory (".concat(this.cwd, ") Files\n");
                        isDesktop = (0, path_1.arePathsEqual)(this.cwd, path.join(os_1.default.homedir(), "Desktop"));
                        if (!isDesktop) return [3 /*break*/, 2];
                        details += "(Desktop files not shown automatically. Use list_files to explore if needed.)";
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, (0, list_files_1.listFiles)(this.cwd, true, 200)];
                    case 3:
                        _a = _b.sent(), files = _a[0], didHitLimit = _a[1];
                        result = responses_1.formatResponse.formatFilesList(this.cwd, files, didHitLimit);
                        details += result;
                        _b.label = 4;
                    case 4: return [2 /*return*/, "<environment_details>\n".concat(details.trim(), "\n</environment_details>")];
                }
            });
        });
    };
    return BaseContextProvider;
}());
exports.BaseContextProvider = BaseContextProvider;
var CliContextProvider = /** @class */ (function (_super) {
    __extends(CliContextProvider, _super);
    function CliContextProvider() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return CliContextProvider;
}(BaseContextProvider));
exports.CliContextProvider = CliContextProvider;
var VsCodeContextProvider = /** @class */ (function (_super) {
    __extends(VsCodeContextProvider, _super);
    function VsCodeContextProvider(cwd, state, vscode) {
        var _this = _super.call(this, cwd, state) || this;
        _this.vscode = vscode;
        return _this;
    }
    VsCodeContextProvider.prototype.getEnvironmentDetails = function () {
        return __awaiter(this, arguments, void 0, function (includeFileDetails) {
            var details, vsCodeDetails, visibleFiles, openTabs;
            var _this = this;
            var _a;
            if (includeFileDetails === void 0) { includeFileDetails = false; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, _super.prototype.getEnvironmentDetails.call(this, includeFileDetails)];
                    case 1:
                        details = _b.sent();
                        vsCodeDetails = "";
                        // Add visible files
                        vsCodeDetails += "\n\n# VSCode Visible Files";
                        visibleFiles = (_a = this.vscode.window.visibleTextEditors) === null || _a === void 0 ? void 0 : _a.map(function (editor) { var _a, _b; return (_b = (_a = editor.document) === null || _a === void 0 ? void 0 : _a.uri) === null || _b === void 0 ? void 0 : _b.fsPath; }).filter(Boolean).map(function (absolutePath) { return path.relative(_this.cwd, absolutePath); }).join("\n");
                        if (visibleFiles) {
                            vsCodeDetails += "\n".concat(visibleFiles);
                        }
                        else {
                            vsCodeDetails += "\n(No visible files)";
                        }
                        // Add open tabs
                        vsCodeDetails += "\n\n# VSCode Open Tabs";
                        openTabs = this.vscode.window.tabGroups.all
                            .flatMap(function (group) { return group.tabs; })
                            .map(function (tab) { var _a, _b; return (_b = (_a = tab.input) === null || _a === void 0 ? void 0 : _a.uri) === null || _b === void 0 ? void 0 : _b.fsPath; })
                            .filter(Boolean)
                            .map(function (absolutePath) { return path.relative(_this.cwd, absolutePath); })
                            .join("\n");
                        if (openTabs) {
                            vsCodeDetails += "\n".concat(openTabs);
                        }
                        else {
                            vsCodeDetails += "\n(No open tabs)";
                        }
                        // Insert VSCode details at the start of the environment details
                        details = details.replace('<environment_details>\n', "<environment_details>".concat(vsCodeDetails));
                        return [2 /*return*/, details];
                }
            });
        });
    };
    return VsCodeContextProvider;
}(BaseContextProvider));
exports.VsCodeContextProvider = VsCodeContextProvider;
