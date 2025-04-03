
var G1 = class e extends Zn {
	constructor(r, n, i, s) {
		super(
			"ExtensionSessionEventReporter",
			n ?? e.defaultMaxRecords,
			i ?? e.defaultUploadMsec,
			s ?? e.defaultBatchSize,
		)
		this._apiServer = r
	}
	static defaultMaxRecords = 1e4
	static defaultBatchSize = 1e3
	static defaultUploadMsec = 1e4
	reportEvent(r, n) {
		this.report({
			time_iso: new Date().toISOString(),
			event_name: r,
			additional_data: n,
		})
	}
	performUpload(r) {
		return this._apiServer.logExtensionSessionEvent(r)
	}
	reportSourceFolders(r) {
		if (!r.workspaceStorageUri) return
		let n = CC(new TextEncoder().encode(r.workspaceStorageUri))
		delete r.workspaceStorageUri
		let i = tk({ projectId: n, ...r })
		this.report({
			time_iso: new Date().toISOString(),
			event_name: "source-folder-snapshot",
			additional_data: Object.entries(i).map(([s, o]) => ({
				key: s,
				value: o,
			})),
		})
	}
	reportConfiguration(r, n, i) {
		let s = tk({
			otherConfig: {
				theme: rg.workspace.getConfiguration().get("workbench.colorTheme"),
				fontSize: rg.workspace.getConfiguration().get("editor.fontSize"),
				isDark: [rg.ColorThemeKind.Dark, rg.ColorThemeKind.HighContrast].includes(
					rg.window.activeColorTheme.kind,
				),
			},
			config: n,
			featureFlags: i,
		})
		for (let o in s) o.toLowerCase().includes("token") && s[o] && (s[o] = "<redacted>")
		this.report({
			time_iso: new Date().toISOString(),
			event_name: "configuration-snapshot",
			additional_data: Object.entries(s).map(([o, a]) => ({
				key: o,
				value: a,
			})),
		})
	}
}