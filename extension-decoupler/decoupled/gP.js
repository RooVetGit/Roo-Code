
var kct = 128 * 1024,
	Gp = {
		gitDiff: !1,
		gitDiffPollingFrequencyMSec: 0,
		additionalChatModels: "",
		smallSyncThreshold: 15,
		bigSyncThreshold: 1e3,
		enableWorkspaceManagerUi: !0,
		enableInstructions: !1,
		enableSmartPaste: !1,
		enableSmartPasteMinVersion: "",
		enableViewTextDocument: !1,
		bypassLanguageFilter: !1,
		enableHindsight: !1,
		maxUploadSizeBytes: kct,
		vscodeNextEditBottomPanelMinVersion: "",
		vscodeNextEditMinVersion: "",
		vscodeNextEditUx1MaxVersion: "",
		vscodeNextEditUx2MaxVersion: "",
		vscodeFlywheelMinVersion: "",
		vscodeExternalSourcesInChatMinVersion: "",
		vscodeShareMinVersion: "",
		maxTrackableFileCount: 25e4,
		maxTrackableFileCountWithoutPermission: 15e4,
		minUploadedPercentageWithoutPermission: 90,
		vscodeSourcesMinVersion: "",
		vscodeChatHintDecorationMinVersion: "",
		nextEditDebounceMs: 400,
		enableCompletionFileEditEvents: !1,
		vscodeEnableCpuProfile: !1,
		verifyFolderIsSourceRepo: !1,
		refuseToSyncHomeDirectories: !1,
		enableFileLimitsForSyncingPermission: !1,
		enableChatMermaidDiagrams: !1,
		enableSummaryTitles: !1,
		smartPastePrecomputeMode: "visible-hover",
		vscodeNewThreadsMenuMinVersion: "",
		vscodeEditableHistoryMinVersion: "",
		vscodeEnableChatMermaidDiagramsMinVersion: "",
		userGuidelinesLengthLimit: 2e3,
		workspaceGuidelinesLengthLimit: 2e3,
		enableGuidelines: !1,
		useCheckpointManagerContextMinVersion: "",
		validateCheckpointManagerContext: !1,
		vscodeDesignSystemRichTextEditorMinVersion: "",
		allowClientFeatureFlagOverrides: !1,
		vscodeChatWithToolsMinVersion: "",
		vscodeChatMultimodalMinVersion: "",
		vscodeAgentModeMinVersion: "",
		vscodeBackgroundAgentsMinVersion: "",
		vscodeAgentEditTool: "backend_edit_tool",
		vscodeRichCheckpointInfoMinVersion: "",
		memoriesParams: {},
		eloModelConfiguration: {
			highPriorityModels: [],
			regularBattleModels: [],
			highPriorityThreshold: 0.5,
		},
		truncateChatHistory: !1,
	},
	ZH = class {
		constructor(t, r, n) {
			this._watchedFlags = r
			this._callback = n
			this._currentFlags = (0, zR.default)(t)
		}
		_disposed = !1
		_currentFlags
		get disposed() {
			return this._disposed
		}
		trigger(t) {
			if (this._disposed) return
			let r = []
			for (let n of this._watchedFlags) t[n] !== this._currentFlags[n] && r.push(n)
			r.length > 0 &&
				this._callback({
					previousFlags: this._currentFlags,
					newFlags: t,
					changedFlags: r,
				})
		}
		dispose() {
			this._disposed = !0
		}
	},
	jR = class extends z {
		_subscriptions = []
		_refreshTimer
		_disposed = !1
		_logger = X("FeatureFlagManager")
		_flags
		constructor(t, r) {
			super(),
				(this._flags = new gy("feature flags", this._logger, r)),
				this._flags.update(t?.initialFlags ?? Gp),
				this._setupRefreshTimer(t),
				this.addDisposable(
					mx.workspace.onDidChangeConfiguration(() => {
						this._subscriptions = this._subscriptions.filter((n) => !n.disposed)
						for (let n of this._subscriptions) n.trigger(this.currentFlags)
					}),
				)
		}
		get currentFlags() {
			if (this._disposed) throw Error("FeatureFlagManager has been disposed")
			return this._flags.value?.allowClientFeatureFlagOverrides
				? {
						...(0, zR.default)(this._flags.value),
						...this.readOverridesFromConfig(),
					}
				: (0, zR.default)(this._flags.value)
		}
		readOverridesFromConfig() {
			let t = mx.workspace.getConfiguration("augment")
			if (t.advanced == null || typeof t.advanced != "object") return {}
			let r = t.advanced.featureFlagOverrides,
				n = {}
			if (typeof r == "object")
				for (let i of Object.keys(r))
					Gp[i] === void 0
						? X("AugmentConfigListener").warn(`Feature flag override for ${i} is not a valid feature flag.`)
						: typeof r[i] != typeof Gp[i]
							? X("AugmentConfigListener").warn(
									`Feature flag override for ${i} is does not match default type ${typeof Gp[i]}.`,
								)
							: r[i] !== void 0 && Gp[i] !== void 0 && Object.assign(n, { [i]: r[i] })
			return n
		}
		update(t) {
			if (this._disposed) throw Error("FeatureFlagManager has been disposed")
			this._flags.update(t), (this._subscriptions = this._subscriptions.filter((r) => !r.disposed))
			for (let r of this._subscriptions) r.trigger(t)
		}
		subscribe(t, r) {
			if (this._disposed) throw Error("FeatureFlagManager has been disposed")
			let n = new ZH(this._flags.value, t, r)
			return this._subscriptions.push(n), n
		}
		_setupRefreshTimer(t) {
			if (!t?.fetcher || !t?.refreshIntervalMSec) return
			this._cleanupRefreshTimer()
			let r = new mx.CancellationTokenSource().token,
				n = t.fetcher,
				i = t.refreshIntervalMSec,
				s = async () => {
					let o = await n(r)
					o ? this.update(o) : r.isCancellationRequested && this._cleanupRefreshTimer()
				}
			this._refreshTimer = setInterval(() => void s(), i)
		}
		_cleanupRefreshTimer() {
			clearInterval(this._refreshTimer), (this._refreshTimer = void 0)
		}
		dispose() {
			this._disposed ||
				(super.dispose(),
				this._subscriptions.forEach((t) => t.dispose()),
				(this._subscriptions = []),
				this._cleanupRefreshTimer(),
				(this._disposed = !0))
		}
	}