"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var nextConfig = {
    webpack: function (config) {
        config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js", ".jsx"] };
        return config;
    },
};
exports.default = nextConfig;
