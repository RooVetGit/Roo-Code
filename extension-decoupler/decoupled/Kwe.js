
function kwe(e, t, r) {
	let n = () => {
		let o = t.config
		Iwe({
			"vscode-augment.enableDebugFeatures": o.enableDebugFeatures,
			"vscode-augment.enableReviewerWorkflows": o.enableReviewerWorkflows,
			"vscode-augment.enableNextEdit": Rl(
				t.config,
				e?.featureFlagManager.currentFlags.vscodeNextEditMinVersion ?? "",
			),
			"vscode-augment.enableNextEditBackgroundSuggestions": y_(
				t.config,
				e?.featureFlagManager.currentFlags.vscodeNextEditMinVersion ?? "",
			),
			"vscode-augment.nextEdit.enableGotoHinting": t.config.nextEdit.enableGotoHinting ?? !1,
			"vscode-augment.nextEdit.enablePanel": e.nextEditConfigManager.config.enablePanel,
		})
	}
	n(), r.subscriptions.push(t.onDidChange(n))
	let i = [
			"enableWorkspaceManagerUi",
			"enableSmartPaste",
			"enableSmartPasteMinVersion",
			"enableInstructions",
			"vscodeSourcesMinVersion",
			"vscodeChatHintDecorationMinVersion",
			"vscodeEnableCpuProfile",
			"vscodeNextEditMinVersion",
		],
		s = () => {
			if (!e) return
			let o = e.featureFlagManager.currentFlags
			Iwe({
				"vscode-augment.workspace-manager-ui.enabled": o.enableWorkspaceManagerUi,
				"vscode-augment.internal-new-instructions.enabled": o.enableInstructions,
				"vscode-augment.internal-dv.enabled": Gr(o.enableSmartPasteMinVersion) || o.enableInstructions,
				"vscode-augment.sources-enabled": Gr(o.vscodeSourcesMinVersion) ?? !1,
				"vscode-augment.chat-hint.decoration": Gr(o.vscodeChatHintDecorationMinVersion) ?? !1,
				"vscode-augment.cpu-profile.enabled": o.vscodeEnableCpuProfile,
				"vscode-augment.nextEdit.enablePanel": e.nextEditConfigManager.config.enablePanel,
			})
		}
	s(),
		r.subscriptions.push(e.featureFlagManager.subscribe(i, s)),
		r.subscriptions.push(e.featureFlagManager.subscribe(i, n))
}