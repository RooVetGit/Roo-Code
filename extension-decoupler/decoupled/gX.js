
var Gx = class {
	constructor(t) {
		this._featureFlagManager = t
	}
	get flags() {
		return {
			enableAgentMode: Gr(this._featureFlagManager.currentFlags.vscodeAgentModeMinVersion ?? ""),
			enableChatWithTools: Gr(this._featureFlagManager.currentFlags.vscodeChatWithToolsMinVersion ?? ""),
			agentEditTool: this._featureFlagManager.currentFlags.vscodeAgentEditTool ?? "",
			memoriesParams: this._featureFlagManager.currentFlags.memoriesParams ?? {},
		}
	}
}