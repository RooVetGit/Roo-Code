
var Pct = { Augment: null },
	Lct = R.object({
		apiToken: R.string(),
		completionURL: R.string(),
		disableCompletionsByLanguage: R.array(R.string()),
		enableAutomaticCompletions: R.boolean(),
		completions: R.object({
			enableAutomaticCompletions: R.boolean(),
			disableCompletionsByLanguage: R.array(R.string()),
			enableQuickSuggestions: R.boolean(),
		}),
		shortcutsDisplayDelayMS: R.number(),
		enableEmptyFileHint: R.boolean(),
		conflictingCodingAssistantCheck: R.boolean(),
		chat: R.object({ userGuidelines: R.string() }),
		nextEdit: R.object({
			enableBackgroundSuggestions: R.boolean(),
			enableGlobalBackgroundSuggestions: R.boolean(),
			highlightSuggestionsInTheEditor: R.boolean(),
			showDiffInHover: R.boolean(),
			enableAutoApply: R.boolean(),
		}),
		advanced: R.object({
			apiToken: R.string(),
			completionURL: R.string(),
			oauth: R.object({ clientID: R.string(), url: R.string() }),
			model: R.string(),
			codeInstruction: R.object({ model: R.string() }),
			chat: R.object({
				url: R.string(),
				model: R.string(),
				stream: R.boolean(),
				enableEditableHistory: R.boolean(),
				useRichTextHistory: R.boolean(),
				smartPasteUsePrecomputation: R.boolean(),
				experimentalFullFilePaste: R.boolean(),
				modelDisplayNameToId: R.record(R.string().nullable()),
			}),
			autofix: R.object({
				enabled: R.boolean(),
				locationUrl: R.string(),
				autofixUrl: R.string(),
			}),
			enableDebugFeatures: R.boolean(),
			enableWorkspaceUpload: R.boolean(),
			enableReviewerWorkflows: R.boolean(),
			completions: R.object({
				timeoutMs: R.number(),
				maxWaitMs: R.number(),
				addIntelliSenseSuggestions: R.boolean(),
				filterThreshold: R.number(),
				filter_threshold: R.number(),
			}),
			openFileManager: R.object({ v2Enabled: R.boolean() }),
			enableDataCollection: R.boolean(),
			nextEditURL: R.string(),
			nextEditLocationURL: R.string(),
			nextEditGenerationURL: R.string(),
			nextEditBackgroundGeneration: R.boolean(),
			nextEdit: R.object({
				enabled: R.boolean(),
				backgroundEnabled: R.boolean(),
				url: R.string(),
				locationUrl: R.string(),
				generationUrl: R.string(),
				model: R.string(),
				useDebounceMs: R.number(),
				useCursorDecorations: R.boolean(),
				allowDuringDebugging: R.boolean(),
				useMockResults: R.boolean(),
				noDiffModeUseCodeLens: R.boolean(),
				enableGotoHinting: R.boolean(),
				enableBottomPanel: R.boolean(),
			}),
			recencySignalManager: R.object({ collectTabSwitchEvents: R.boolean() }),
			preferenceCollection: R.object({
				enable: R.boolean(),
				enableRetrievalDataCollection: R.boolean(),
				enableRandomizedMode: R.boolean(),
			}),
			vcs: R.object({ watcherEnabled: R.boolean() }),
			smartPaste: R.object({ url: R.string(), model: R.string() }),
			instructions: R.object({ model: R.string() }),
			integrations: R.object({
				atlassian: R.object({
					serverUrl: R.string(),
					personalApiToken: R.string(),
					username: R.string(),
				}),
				notion: R.object({ apiToken: R.string() }),
				linear: R.object({ apiToken: R.string() }),
				github: R.object({ apiToken: R.string() }),
			}),
			mcpServers: R.array(
				R.object({
					command: R.string(),
					args: R.array(R.string()),
					timeoutMs: R.number(),
					env: R.record(R.string()),
				}),
			),
			agent: R.object({
				shellCommandsAlwaysSafe: R.boolean(),
				useIDETerminalForShellCommands: R.boolean(),
				disableRetrievalTool: R.boolean(),
			}),
			remoteAgent: R.object({ url: R.string(), apiToken: R.string() }),
		}),
	}),
	UAe = Lct.deepPartial(),
	sk = class e extends z {
		_config
		_configChanged = new bc.EventEmitter()
		_configMonitor
		_logger = X("AugmentConfigListener")
		constructor() {
			super(),
				(this._configMonitor = new gy("Config", this._logger)),
				this._refreshConfig(),
				this.addDisposable(bc.workspace.onDidChangeConfiguration(() => this._refreshConfig()))
		}
		get config() {
			return this._config
		}
		get onDidChange() {
			return this._configChanged.event
		}
		_refreshConfig() {
			let t = this._config
			;(this._config = e.normalizeConfig(this._getRawSettings())),
				this._configMonitor.update(this._config) &&
					this._configChanged.fire({
						previousConfig: t,
						newConfig: this._config,
					})
		}
		static normalizeConfig(t) {
			return {
				apiToken: (t?.advanced?.apiToken ?? t.apiToken ?? "").trim().toUpperCase(),
				completionURL: (t?.advanced?.completionURL ?? t.completionURL ?? "").trim(),
				modelName: t?.advanced?.model ?? "",
				conflictingCodingAssistantCheck: t.conflictingCodingAssistantCheck ?? !0,
				codeInstruction: { model: t.advanced?.codeInstruction?.model },
				chat: {
					url: t.advanced?.chat?.url,
					model: t.advanced?.chat?.model,
					stream: t.advanced?.chat?.stream,
					enableEditableHistory: t.advanced?.chat?.enableEditableHistory ?? !1,
					useRichTextHistory: t.advanced?.chat?.useRichTextHistory ?? !0,
					smartPasteUsePrecomputation: t.advanced?.chat?.smartPasteUsePrecomputation ?? !0,
					experimentalFullFilePaste: t.advanced?.chat?.experimentalFullFilePaste ?? !1,
					modelDisplayNameToId: t.advanced?.chat?.modelDisplayNameToId ?? Pct,
					userGuidelines: t.chat?.userGuidelines || "",
				},
				autofix: {
					enabled: t.advanced?.autofix?.enabled ?? !1,
					locationUrl: t.advanced?.autofix?.locationUrl,
					autofixUrl: t.advanced?.autofix?.autofixUrl,
				},
				oauth: {
					clientID: t.advanced?.oauth?.clientID ?? "augment-vscode-extension",
					url: t.advanced?.oauth?.url ?? "https://auth.augmentcode.com",
				},
				enableUpload: t.advanced?.enableWorkspaceUpload ?? !0,
				shortcutsDisplayDelayMS: t.shortcutsDisplayDelayMS ?? 2e3,
				enableEmptyFileHint: t.enableEmptyFileHint ?? !0,
				enableDataCollection: t.advanced?.enableDataCollection ?? !1,
				enableDebugFeatures: t.advanced?.enableDebugFeatures ?? !1,
				enableReviewerWorkflows: t.advanced?.enableReviewerWorkflows ?? !1,
				completions: {
					enableAutomaticCompletions:
						t.enableAutomaticCompletions ?? t.completions?.enableAutomaticCompletions ?? !0,
					disableCompletionsByLanguage: new Set(
						t.disableCompletionsByLanguage ?? t.completions?.disableCompletionsByLanguage ?? [],
					),
					enableQuickSuggestions: t.completions?.enableQuickSuggestions ?? !0,
					timeoutMs: t.advanced?.completions?.timeoutMs ?? 800,
					maxWaitMs: t.advanced?.completions?.maxWaitMs ?? 1600,
					addIntelliSenseSuggestions: t.advanced?.completions?.addIntelliSenseSuggestions ?? !0,
					filterThreshold: t.advanced?.completions?.filter_threshold,
				},
				openFileManager: {
					v2Enabled: t.advanced?.openFileManager?.v2Enabled ?? !1,
				},
				nextEdit: {
					enabled: t.advanced?.nextEdit?.enabled,
					backgroundEnabled: t.advanced?.nextEdit?.backgroundEnabled ?? !0,
					url: t.advanced?.nextEdit?.url,
					locationUrl: t.advanced?.nextEdit?.locationUrl ?? t.advanced?.nextEdit?.url,
					generationUrl: t.advanced?.nextEdit?.generationUrl ?? t.advanced?.nextEdit?.url,
					model: t.advanced?.nextEdit?.model,
					useDebounceMs: t.advanced?.nextEdit?.useDebounceMs,
					useCursorDecorations: t.advanced?.nextEdit?.useCursorDecorations ?? !1,
					allowDuringDebugging: t.advanced?.nextEdit?.allowDuringDebugging ?? !1,
					useMockResults: t.advanced?.nextEdit?.useMockResults ?? !1,
					noDiffModeUseCodeLens: t.advanced?.nextEdit?.noDiffModeUseCodeLens ?? !1,
					enableBackgroundSuggestions: t.nextEdit?.enableBackgroundSuggestions ?? !0,
					enableGlobalBackgroundSuggestions: t.nextEdit?.enableGlobalBackgroundSuggestions ?? !1,
					highlightSuggestionsInTheEditor: t.nextEdit?.highlightSuggestionsInTheEditor ?? !1,
					showDiffInHover: t.nextEdit?.showDiffInHover ?? !1,
					enableAutoApply: t.nextEdit?.enableAutoApply ?? !0,
					enableGotoHinting: t.advanced?.nextEdit?.enableGotoHinting ?? !1,
					enableBottomPanel: t.advanced?.nextEdit?.enableBottomPanel,
				},
				recencySignalManager: {
					collectTabSwitchEvents: t.advanced?.recencySignalManager?.collectTabSwitchEvents ?? !1,
				},
				preferenceCollection: {
					enable: t.advanced?.preferenceCollection?.enable ?? !1,
					enableRetrievalDataCollection:
						t.advanced?.preferenceCollection?.enableRetrievalDataCollection ?? !1,
					enableRandomizedMode: t.advanced?.preferenceCollection?.enableRandomizedMode ?? !0,
				},
				vcs: { watcherEnabled: t.advanced?.vcs?.watcherEnabled ?? !1 },
				smartPaste: {
					url: t.advanced?.smartPaste?.url,
					model: t.advanced?.smartPaste?.model,
				},
				instructions: { model: t.advanced?.instructions?.model },
				integrations: {
					atlassian: t.advanced?.integrations?.atlassian
						? {
								serverUrl: t.advanced.integrations.atlassian.serverUrl || "",
								personalApiToken: t.advanced.integrations.atlassian.personalApiToken || "",
								username: t.advanced.integrations.atlassian.username || "",
							}
						: void 0,
					notion: t.advanced?.integrations?.notion
						? { apiToken: t.advanced.integrations.notion.apiToken || "" }
						: void 0,
					linear: t.advanced?.integrations?.linear
						? { apiToken: t.advanced.integrations.linear.apiToken || "" }
						: void 0,
					github: t.advanced?.integrations?.github
						? { apiToken: t.advanced.integrations.github.apiToken || "" }
						: void 0,
				},
				mcpServers: (t.advanced?.mcpServers ?? [])
					.filter((r) => r !== void 0)
					.map((r) => ({
						command: OAe(r.command || ""),
						args: r.args?.map((n) => OAe(n)),
						timeoutMs: r.timeoutMs,
						env: r.env,
					})),
				agent: {
					shellCommandsAlwaysSafe: t.advanced?.agent?.shellCommandsAlwaysSafe ?? !1,
					useIDETerminalForShellCommands: t.advanced?.agent?.useIDETerminalForShellCommands ?? !0,
					disableRetrievalTool: t.advanced?.agent?.disableRetrievalTool ?? !1,
				},
				remoteAgent: {
					url: t.advanced?.remoteAgent?.url,
					apiToken: t.advanced?.remoteAgent?.apiToken,
				},
			}
		}
		_getRawSettings() {
			let t = bc.workspace.getConfiguration("augment")
			return e.parseSettings(t)
		}
		async migrateLegacyConfig() {
			let t = bc.workspace.getConfiguration("augment")
			await this._moveConfig(t, "enableAutomaticCompletions", "completions.enableAutomaticCompletions"),
				await this._moveConfig(t, "disableCompletionsByLanguage", "completions.disableCompletionsByLanguage"),
				await this._moveConfig(t, "enableBackgroundSuggestions", "nextEdit.enableBackgroundSuggestions"),
				await this._moveConfig(
					t,
					"enableGlobalBackgroundSuggestions",
					"nextEdit.enableGlobalBackgroundSuggestions",
				),
				await this._moveConfig(t, "highlightSuggestionsInTheEditor", "nextEdit.highlightSuggestionsInTheEditor")
		}
		async _moveConfig(t, r, n) {
			let i = t.inspect(r)
			if (!i) return
			let s = t.inspect(n),
				o = [
					{
						target: bc.ConfigurationTarget.Workspace,
						oldValue: i.workspaceValue,
						newValue: s?.workspaceValue,
					},
					{
						target: bc.ConfigurationTarget.Global,
						oldValue: i.globalValue,
						newValue: s?.globalValue,
					},
				]
			for (let a of o)
				a.oldValue !== void 0 &&
					(a.newValue === void 0 && (await t.update(n, a.oldValue, a.target)),
					await t.update(r, void 0, a.target))
		}
		static parseSettings(t) {
			let r = X("AugmentConfigListener"),
				n = UAe.safeParse(t)
			if (!n.success) {
				let i = n.error.issues.map((l) => "[" + l.path.join(".") + "]: " + l.message)
				r.error(`Failed to parse settings: 
${i.join(`
`)}`)
				let s = n.error.issues.map((l) => l.path.join(".")),
					o = (0, qAe.omit)(JSON.parse(JSON.stringify(t)), s),
					a = UAe.safeParse(o)
				return a.success ? (r.info("settings parsed successfully after cleaning"), a.data) : {}
			}
			return r.info("settings parsed successfully"), n.data
		}
	}