/**
 * Class representing the main extension functionality.
 * 
 * This class handles the initialization and management of various components
 * related to the extension, including feature flags, metrics reporting,
 * and session management. It also manages the state of the extension and
 * provides methods for enabling and configuring its features.
 * 
 * @param {Object} extensionContext - The extension context.
 * @param {Object} globalState - The global state.
 * @param {Function} configListener - The augment configuration listener.
 * @param {Object} apiServer - The API server instance.
 * @param {Object} auth - The authentication object.
 * @param {Array} recentCompletions - Recent completions.
 * @param {Array} recentInstructions - Recent instructions.
 * @param {Array} recentNextEditResults - Recent next edit results.
 * @param {Array} recentChats - Recent chats.
 * @param {Object} nextEditWebViewEvent - Next edit web view event.
 * @param {Function} onboardingSessionReporter - Onboarding session event reporter.
 * @param {Object} mainPanelProvider - Main panel provider.
 * @param {Function} changeWebviewAppEvent - Change webview app event.
 * @param {Object} actionsModel - Actions model.
 * @param {boolean} syncingEnabledTracker - Syncing enabled tracker.
 * @param {Object} chatExtensionEvent - Chat extension event.
 * @param {Function} onboardingSessionEventReporter - Onboarding session event reporter.
 * @param {Object} assetManager - Asset manager.
 */

var AugmentExtension = class AugmentExtensionClass extends BaseClass {
	constructor(extensionContext, globalState, configListener, apiServer, auth, recentCompletions, recentInstructions, recentNextEditResults, recentChats, nextEditWebViewEvent, onboardingSessionReporter, mainPanelProvider, changeWebviewAppEvent, actionsModel, syncingEnabledTracker, chatExtensionEvent, onboardingSessionEventReporter, assetManager) {
		super()
		this._extensionContext = extensionContext
		this._globalState = globalState
		this._configListener = configListener
		this._apiServer = apiServer
		this._auth = auth
		this._recentCompletions = recentCompletions
		this._recentInstructions = recentInstructions
		this._recentNextEditResults = recentNextEditResults
		this._recentChats = recentChats
		this._nextEditWebViewEvent = nextEditWebViewEvent
		this._onExtensionUpdateEvent = onboardingSessionReporter
		this._mainPanelProvider = mainPanelProvider
		this._changeWebviewAppEvent = changeWebviewAppEvent
		this._actionsModel = actionsModel
		this._syncingEnabledTracker = syncingEnabledTracker
		this._chatExtensionEvent = chatExtensionEvent
		this._onboardingSessionEventReporter = onboardingSessionEventReporter
		this._assetManager = assetManager
		if (
			((this._statusBar = new StatusBar()),
			extensionContext.subscriptions.push(this._statusBar),
			(this.featureFlagManager = new FeatureFlagManager(
				{
					fetcher: this._fetchFeatureFlags.bind(this),
					refreshIntervalMSec: 30 * 60 * 1e3,
				},
				this._configListener,
			)),
			(this._completionAcceptanceReporter = new CompletionAcceptanceReporter(apiServer, this._onboardingSessionEventReporter)),
			(this._codeEditReporter = new CodeEditReporter(apiServer)),
			(this._nextEditResolutionReporter = new NextEditResolutionReporter(apiServer)),
			(this._nextEditSessionEventReporter = new NextEditSessionEventReporter(apiServer)),
			(this.nextEditConfigManager = new NextEditConfigManager(
				this._configListener,
				this.featureFlagManager,
				this._globalState,
			)),
			(this._clientMetricsReporter = new ClientMetricsReporter(apiServer)),
			(this._completionTimelineReporter = new CompletionTimelineReporter(apiServer)),
			(this._agentSessionEventReporter = new AgentSessionEventReporter(new AgentConfig(this.featureFlagManager))),
			(this._agentRequestEventReporter = new AgentRequestEventReporter(apiServer)),
			(this._extensionEventReporter = new ExtensionEventReporter(apiServer)),
			(this.guidelinesWatcher = new GuidelinesWatcher(
				this._configListener,
				this.featureFlagManager,
				this._clientMetricsReporter,
			)),
			(this._toolUseRequestEventReporter = new ToolUseRequestEventReporter()),
			this.disposeOnDisable.push(this.guidelinesWatcher),
			this.addDisposable(new Disposable(() => this.disable())),
			(this._completionsModel = new CompletionsModel(this, this._configListener, this._clientMetricsReporter)),
			!isVersionSupported("1.96.0"))
		)
			try {
				this._logger.info("Starting macCA"), (0, Twe.addToGlobalAgent)(), this._logger.info("macCa Done")
			} catch (error) {
				this._logger.error("Exception loading mac-ca certs:", error)
			}
	}
	static augmentRootName = ".augmentroot"
	static contentScheme = "augment"
	static displayStatusUri = Uri.from({
		scheme: this.contentScheme,
		path: "Augment Extension Status",
	})
	static modelConfigBackoffMsecMax = 3e4
	keybindingWatcher = void 0
	_completionServer = void 0
	workspaceManager = void 0
	syncingStatusReporter = void 0
	fuzzyFileSearcher = void 0
	fuzzySymbolSearcher = void 0
	_toolsModel = void 0
	get toolsModel() {
		return this._toolsModel
	}
	_toolConfigStore = void 0
	get toolConfigStore() {
		return this._toolConfigStore
	}
	_agentCheckpointManager = void 0
	guidelinesWatcher
	_statusBar
	_initState
	_enableCancel
	_defaultModel
	_modelInfo
	_blobNameCalculator
	_nextEditRequestManager
	_suggestionManager
	get modelInfo() {
		return this._modelInfo
	}
	userTier = "unknown"
	_availableModels = []
	_languages = []
	get languages() {
		return this._languages
	}
	featureFlagManager
	_onTextDocumentDidChange = new EventEmitter()
	_statusTrace
	_completionDisposables = []
	_completionAcceptanceReporter
	_codeEditReporter
	_nextEditResolutionReporter
	_nextEditSessionEventReporter
	nextEditConfigManager
	_clientMetricsReporter
	_completionTimelineReporter
	_extensionEventReporter
	_agentSessionEventReporter
	_agentRequestEventReporter
	_dataCollector
	_editorNextEdit
	_backgroundNextEdit
	_globalNextEdit
	_diagnosticsManager
	_nextEditVSCodeToWebviewMessage = new EventEmitter()
	_openChatHintManager
	enabled = !1
	_enableState
	disposeOnDisable = []
	_inlineCompletionProvider
	_completionsModel
	_logger = Logger("AugmentExtension")
	_chatModel
	_currentChatExtensionEventDisposable
	_toolUseRequestEventReporter
	get sessionId() {
		return this._apiServer.sessionId
	}
	get chatModel() {
		return this._chatModel
	}
	get editorNextEdit() {
		return this._editorNextEdit
	}
	get agentSessionEventReporter() {
		return this._agentSessionEventReporter
	}
	get completionServer() {
		return this._completionServer
	}
	get completionsModel() {
		return this._completionsModel
	}
	get agentCheckpointManager() {
		return this._agentCheckpointManager
	}
	get enableInProgress() {
		return this._enableCancel !== void 0
	}
	get ready() {
		return this.enabled && !this.enableInProgress
	}
	async enable() {
		if (this.enabled || this.enableInProgress) return
		let cancellationTokenSource = new CancellationTokenSource()
		this._enableCancel = cancellationTokenSource
		try {
			await this._enable(cancellationTokenSource.token)
		} catch (error) {
			if ((this._logger.info(`Unable to enable extension: ${Ye(error)}`), process.env.JEST_WORKER_ID)) throw error
		} finally {
			cancellationTokenSource.dispose(), (this._enableCancel = void 0)
		}
	}
	_syncLastEnabledExtensionVersion() {
		if (this._extensionContext.extensionMode === ExtensionMode.Development) return !1
		let currentVersion = this._extensionContext.extension.packageJSON.version
		return this._extensionVersion === currentVersion
			? !1
			: (this._globalState.update("lastEnabledExtensionVersion", currentVersion), this._onExtensionUpdateEvent.fire(), !0)
	}
	get _extensionVersion() {
		return this._globalState.get("lastEnabledExtensionVersion") || ""
	}
	async _enable(cancellationToken) {
		if (
			((0, Swe.assert)(!this.enabled),
			this._initState?.dispose(),
			this._enableState?.dispose(),
			this.disposeOnDisable.push(
				new MetricsReporter(this._clientMetricsReporter, {
					periodMs: 100,
					debugThresholdMs: 50,
					infoThresholdMs: 2e3,
				}),
			),
			this._auth.useOAuth)
		) {
			if (!(await this._auth.getSession())) {
				this._enableState = this._statusBar.setState(Qxe)
				return
			}
		} else {
			if (!this._configListener.config.apiToken) {
				this._logger.warn("No API token is configured"), (this._enableState = this._statusBar.setState(Pxe))
				return
			}
			if (!this._configListener.config.completionURL) {
				this._logger.warn("No completion URL is configured"),
					(this._enableState = this._statusBar.setState(Lxe))
				return
			}
		}
		let statusBarState = this._statusBar.setState(Uxe),
			modelConfig,
			modelMap = new Map()
		try {
			if (((modelConfig = await this._getModelConfig(cancellationToken)), modelConfig.models.length === 0)) throw new ModelConfigError()
			;(this.userTier = modelConfig.userTier),
				je.commands.executeCommand("setContext", "augment.userTier", this.userTier),
				(this._defaultModel = modelConfig.defaultModel),
				(this._languages = modelConfig.languages),
				(this._availableModels = modelConfig.models.map((model) => `${model.name} - ${model.internalName}`))
			let selectedModelName = this._configListener.config.modelName || modelConfig.defaultModel
			if (
				((this._modelInfo = modelConfig.models.find(
					(model) =>
						[model.name, model.internalName].includes(selectedModelName) ||
						model.name === (0, Bwe.createHash)("sha256").update(selectedModelName).digest("hex"),
				)),
				this._modelInfo === void 0)
			)
				throw new ModelNotFoundError(selectedModelName)
			this.featureFlagManager.update(modelConfig.featureFlags)
			for (let model of modelConfig.models) modelMap.set(model.name, model)
			this._initState?.dispose()
		} catch (error) {
			if (kr.isAPIErrorWithStatus(error, He.unauthenticated)) {
				this._auth.useOAuth
					? (this._enableState = this._statusBar.setState(Oxe))
					: (this._enableState = this._statusBar.setState(qxe))
				return
			} else if (error instanceof Yp) {
				this._enableState = this._statusBar.setState(Vxe)
				return
			} else if (error instanceof je.CancellationError) return
			let errorMessage = Ye(error)
			throw (
				(this._logger.error(`Failed to get model config: ${errorMessage}`),
				(this._initState = this._statusBar.setState(t8)),
				error)
			)
		} finally {
			statusBarState.dispose()
		}
		this.featureFlagManager.currentFlags.enableViewTextDocument &&
			(this._logger.debug("Enabling viewTextDocument background file scheme"), this.disposeOnDisable.push(pme()))
		let workspaceState = new WorkspaceState(this._extensionContext.workspaceState)
		this.disposeOnDisable.push(workspaceState),
			(this._completionServer = new CompletionServer(
				this._apiServer,
				this._modelInfo.completionTimeoutMs,
				this._modelInfo.suggestedPrefixCharCount,
				this._modelInfo.suggestedSuffixCharCount,
			))
		let maxUploadSizeBytes = this.featureFlagManager.currentFlags.maxUploadSizeBytes
		;(this._blobNameCalculator = new BlobNameCalculator(maxUploadSizeBytes)),
			(this.workspaceManager = new WorkspaceManager(
				this._actionsModel,
				new WorkspaceState(this._extensionContext.workspaceState),
				workspaceState,
				this._extensionContext,
				this._apiServer,
				this._configListener,
				this.featureFlagManager,
				this._clientMetricsReporter,
				this._completionServer,
				this._blobNameCalculator,
				maxUploadSizeBytes,
				this._syncingEnabledTracker,
				this._onboardingSessionEventReporter,
				modelConfig.languages,
			)),
			this.disposeOnDisable.push(this.workspaceManager)
		let debounceReportSourceFolders = (0, Dwe.debounce)(() => {
			let sourceFoldersReportDetails = this.workspaceManager?.getSourceFoldersReportDetails()
			sourceFoldersReportDetails !== void 0 && this._extensionEventReporter.reportSourceFolders(sourceFoldersReportDetails)
		}, 5e3)
		this.disposeOnDisable.push(this.workspaceManager.onDidEnumerateFolder(() => debounceReportSourceFolders())),
			this.disposeOnDisable.push(this.workspaceManager.onDidChangeSourceFolders(() => debounceReportSourceFolders())),
			(this.syncingStatusReporter = new SyncingStatusReporter(this.featureFlagManager, this.workspaceManager)),
			this.disposeOnDisable.push(this.syncingStatusReporter),
			this.disposeOnDisable.push(new StatusBarSyncingStatusReporter(this._statusBar, this.syncingStatusReporter.onDidChangeSyncingStatus)),
			(this.keybindingWatcher = new KeybindingWatcher(this._globalState)),
			this.disposeOnDisable.push(this.keybindingWatcher),
			(this._diagnosticsManager = new DiagnosticsManager()),
			this.disposeOnDisable.push(this._diagnosticsManager)
		let statusBarUpdater = new StatusBarUpdater(this._statusBar)
		this.disposeOnDisable.push(statusBarUpdater)
		let inlineCompletionProvider = new InlineCompletionProvider()
		this.disposeOnDisable.push(
			hxe((event) => {
				event.acceptedIdx >= 0 && inlineCompletionProvider.set(!0, event.document)
			}),
		),
			this.disposeOnDisable.push(inlineCompletionProvider)
		let toolUseRequestEventReporter = new ToolUseRequestEventReporter()
		this.disposeOnDisable.push(toolUseRequestEventReporter),
			(this._suggestionManager = new SuggestionManager(this.workspaceManager, this._nextEditSessionEventReporter)),
			this.disposeOnDisable.push(this._suggestionManager),
			(this._nextEditRequestManager = new NextEditRequestManager(
				this._apiServer,
				this._configListener,
				this.workspaceManager,
				this._diagnosticsManager,
				this._nextEditSessionEventReporter,
				this._clientMetricsReporter,
				this._blobNameCalculator,
				this._suggestionManager,
				this._recentNextEditResults,
				statusBarUpdater,
				inlineCompletionProvider,
				this.featureFlagManager,
			)),
			this.disposeOnDisable.push(this._nextEditRequestManager),
			(this._editorNextEdit = new EditorNextEdit(
				this._extensionContext,
				this.workspaceManager,
				this._nextEditSessionEventReporter,
				this.keybindingWatcher,
				this._configListener,
				this._suggestionManager,
				this._nextEditRequestManager,
				this._globalState,
				this.nextEditConfigManager,
				toolUseRequestEventReporter,
				(eventData) => {
					this._nextEditWebViewEvent.fire({
						type: "next-edit-active-suggestion",
						data: eventData,
					})
				},
			)),
			this.disposeOnDisable.push(this._editorNextEdit),
			(this._globalNextEdit = new GlobalNextEdit(
				this.workspaceManager,
				this._nextEditRequestManager,
				this._suggestionManager,
				this._configListener,
				this._nextEditSessionEventReporter,
			)),
			this.disposeOnDisable.push(this._globalNextEdit)
		let chatHintOptions = [
			{
				text: this.featureFlagManager.currentFlags.enableInstructions ? "Chat" : "Open in Augment Chat",
				keyBindingId: Hi.commandID,
			},
		]
		this.featureFlagManager.currentFlags.enableInstructions &&
			chatHintOptions.push({ text: "Instruct", keyBindingId: $y.commandID }),
			(this._openChatHintManager = new OpenChatHintManager(
				this._configListener,
				this._extensionContext,
				this.keybindingWatcher,
				this.featureFlagManager,
				chatHintOptions,
			)),
			this._openChatHintManager.enable(),
			this.disposeOnDisable.push(this._openChatHintManager),
			(this.fuzzyFileSearcher = new FuzzyFileSearcher(
				this._globalState,
				this.workspaceManager,
				this.syncingStatusReporter.onDidChangeSyncingStatus,
			)),
			(this.fuzzySymbolSearcher = new FuzzySymbolSearcher(
				this._globalState,
				this._configListener,
				this.fuzzyFileSearcher,
				this.workspaceManager,
			)),
			this.disposeOnDisable.push(this.fuzzyFileSearcher),
			this.disposeOnDisable.push(this.fuzzySymbolSearcher),
			await yme(this._extensionContext.storageUri, this._logger)
		let getMemoriesPath = () => {
			let storageUri = this._extensionContext.storageUri
			if (storageUri) return Uri.joinPath(storageUri, "Augment-Memories").fsPath
		}
		b$(new MemoriesManager(this.workspaceManager)),
			this.disposeOnDisable.push(new Disposable(() => x$())),
			cY(new APIManager(this._apiServer, this.workspaceManager)),
			this.disposeOnDisable.push(new Disposable(() => uY())),
			p$(this._assetManager),
			this.disposeOnDisable.push(new Disposable(() => A$())),
			(this._agentCheckpointManager = new AgentCheckpointManager(new CheckpointConfig(), getMemoriesPath, (event) =>
				je.workspace.onDidChangeTextDocument((documentChangeEvent) => {
					let resolvedPath = this.workspaceManager?.safeResolvePathName(documentChangeEvent.document.uri)
					if (!resolvedPath) return
					let documentChangeData = {
						document: {
							qualifiedPathName: resolvedPath,
							getText: () => documentChangeEvent.document.getText(),
						},
						contentChanges: documentChangeEvent.contentChanges.map((change) => ({
							text: change.text,
							range: change.range
								? {
										start: {
											line: change.range.start.line,
											character: change.range.start.character,
										},
										end: {
											line: change.range.end.line,
											character: change.range.end.character,
										},
									}
								: void 0,
						})),
					}
					event(documentChangeData)
				}),
			)),
			this.disposeOnDisable.push(this._agentCheckpointManager),
			(this._toolsModel = new ToolsModel(
				[],
				ToolServer(
					this._apiServer,
					this.workspaceManager,
					this._agentCheckpointManager,
					this.featureFlagManager,
					this._extensionContext.extensionUri,
					this._agentSessionEventReporter,
				),
				new ToolConfig(this._apiServer, this._configListener),
				(error) => {
					je.window.showErrorMessage("Failed to start the MCP server. " + JSON.stringify(error))
				},
				new AgentConfig(this.featureFlagManager),
				this._agentCheckpointManager,
				getMemoriesPath,
				() => this._configListener.config.agent,
				() => this._toolUseRequestEventReporter,
				{ unsupportedTools: new Set([]) },
				"Augment-VSCode/1.0",
			)),
			dY(new ToolManager(this._agentCheckpointManager, this._toolsModel)),
			this.disposeOnDisable.push(new Disposable(() => fY())),
			(this._toolConfigStore = new ToolConfigStore(
				this._globalState,
				this._toolsModel,
				() => this._configListener.config.mcpServers,
			)),
			this.disposeOnDisable.push(
				new Disposable(() => {
					this._toolConfigStore = void 0
				}),
			),
			this._toolConfigStore.updateSidecarMCPServers(),
			(async (memories) => {
				let memoriesPath = memories.memoriesAbsPath
				if (memoriesPath) {
					let memoriesUri = Uri.file(memoriesPath)
					try {
						await xy(memoriesUri.fsPath)
					} catch {
						await Bu(memoriesUri.fsPath, "")
					}
				}
				this.addDisposable(
					je.window.onDidChangeActiveTextEditor(async (editor) => {
						await Eme(editor, getMemoriesPath, this._globalState), await CW(editor, getMemoriesPath, this._globalState)
					}),
				),
					this.addDisposable(
						je.workspace.onDidChangeTextDocument((documentChangeEvent) => {
							xme(documentChangeEvent, je.window.activeTextEditor, getMemoriesPath, this._globalState)
						}),
					),
					this.addDisposable(vme())
			})(this._toolsModel),
			this.addDisposable(
				this._configListener.onDidChange(({ newConfig: newConfig, previousConfig: previousConfig }) => {
					this._toolsModel &&
						((0, E6.default)(newConfig.mcpServers, previousConfig.mcpServers) ||
							this._toolConfigStore?.updateSidecarMCPServers(),
						newConfig.agent.disableRetrievalTool !== previousConfig.agent.disableRetrievalTool &&
							this._toolsModel.restartHosts())
				}),
			)
		let chatModel = new ChatModel(
			this._globalState,
			this._apiServer,
			this.workspaceManager,
			this._recentChats,
			this.fuzzySymbolSearcher,
			this._assetManager,
		)
		this._chatModel = chatModel
		let syncingStatusReporter = new SyncingStatusReporter(this._globalState, this.syncingStatusReporter),
			workspaceContext = new WorkspaceContext(),
			chatExtension = new ChatExtension(
				chatModel,
				apiServer,
				this._apiServer,
				this.workspaceManager,
				this.keybindingWatcher,
				this._configListener,
				this._extensionContext.extensionUri,
				this.featureFlagManager,
				this._clientMetricsReporter,
				this._actionsModel,
				this._syncingEnabledTracker,
				syncingStatusReporter,
				this.syncingStatusReporter,
				this._onboardingSessionEventReporter,
				this.fuzzyFileSearcher,
				this.fuzzySymbolSearcher,
				this._toolsModel,
				workspaceContext,
				this._agentCheckpointManager,
				this.guidelinesWatcher,
				this._assetManager,
				this._agentSessionEventReporter,
				this._agentRequestEventReporter,
				this._globalState,
			)
		;(this._currentChatExtensionEventDisposable = this._chatExtensionEvent.event(chatExtension.onChatExtensionMessage)),
			this.disposeOnDisable.push(this._currentChatExtensionEventDisposable),
			this._mainPanelProvider.changeApp(chatExtension)
		let workspaceManager = this.workspaceManager,
			keybindingWatcher = this.keybindingWatcher
		this.disposeOnDisable.push(
			this._changeWebviewAppEvent.event((appType) => {
				let newChatExtension, chatEvent
				switch ((this._currentChatExtensionEventDisposable?.dispose(), appType)) {
					case "chat":
						;(newChatExtension = new ChatExtension(
							chatModel,
							apiServer,
							this._apiServer,
							workspaceManager,
							keybindingWatcher,
							this._configListener,
							this._extensionContext.extensionUri,
							this.featureFlagManager,
							this._clientMetricsReporter,
							this._actionsModel,
							this._syncingEnabledTracker,
							syncingStatusReporter,
							this.syncingStatusReporter,
							this._onboardingSessionEventReporter,
							this.fuzzyFileSearcher,
							this.fuzzySymbolSearcher,
							this._toolsModel,
							workspaceContext,
							this._agentCheckpointManager,
							this.guidelinesWatcher,
							this._assetManager,
							this._agentSessionEventReporter,
							this._agentRequestEventReporter,
							this._globalState,
						)),
							this._mainPanelProvider.changeApp(newChatExtension),
							(chatEvent = this._chatExtensionEvent.event(newChatExtension.onChatExtensionMessage)),
							(this._currentChatExtensionEventDisposable = chatEvent),
							this.disposeOnDisable.push(this._currentChatExtensionEventDisposable)
						break
					case "sign-in":
						break
					case "workspace-context":
						this._mainPanelProvider.changeApp(new WorkspaceContextApp(workspaceManager, this.featureFlagManager))
						break
					case "awaiting-syncing-permission":
						this._mainPanelProvider.changeApp(
							new SyncingPermissionApp(
								this._actionsModel,
								this._apiServer,
								this._configListener,
								this._syncingEnabledTracker,
								this._changeWebviewAppEvent,
								this.featureFlagManager,
								this._configListener.userTier,
							),
						)
						break
					case "folder-selection":
						this._mainPanelProvider.changeApp(new FolderSelectionApp())
						break
					default: {
						let unhandledAppType = appType
						throw new Error(`Unhandled app case: ${unhandledAppType}`)
					}
				}
			}),
		),
			this.disposeOnDisable.push(
				this._configListener.onDidChange(this._checkInlineCompletionsEnabled.bind(this)),
			),
			this._checkInlineCompletionsEnabled(),
			this.disposeOnDisable.push(new Disposable(() => this._disableInlineCompletions.bind(this)))
		{
			let inlineCompletionState,
				debugCompletionState,
				codeActionProvider,
				automaticCompletionState,
				inlineCompletionProviderState,
				codeActionProviderState,
				automaticCompletionStateTracker,
				updateCompletionState = (newConfig, previousConfig) => {
					inlineCompletionState?.dispose(),
						debugCompletionState?.dispose(),
						codeActionProvider?.dispose(),
						automaticCompletionState?.dispose(),
						inlineCompletionProviderState?.dispose(),
						codeActionProviderState?.dispose(),
						automaticCompletionStateTracker?.dispose(),
						newConfig.completions.enableAutomaticCompletions || (debugCompletionState = this._statusBar.setState(Hxe)),
						newConfig.enableDebugFeatures && this.keybindingWatcher
							? ((automaticCompletionState = new DebugCompletionState(this.keybindingWatcher, this._inlineCompletionProvider)),
								this.disposeOnDisable.push(automaticCompletionState))
							: newConfig.completions.enableAutomaticCompletions &&
								this.keybindingWatcher &&
								((inlineCompletionProviderState = new InlineCompletionProviderState(this.keybindingWatcher, this._inlineCompletionProvider)),
								this.disposeOnDisable.push(inlineCompletionProviderState)),
						(codeActionProviderState = je.languages.registerCodeActionsProvider("*", new CodeActionProvider())),
						this.disposeOnDisable.push(codeActionProviderState),
						newConfig.enableUpload || (inlineCompletionState = this._statusBar.setState(Wxe))
					let enableDataCollection = newConfig.enableDataCollection || this._configListener.featureFlags.enableHindsight
					this._dataCollector && !enableDataCollection
						? (this._logger.debug("Disabling Hindsight Data"),
							this._dataCollector.dispose(),
							(this._dataCollector = void 0))
						: !this._dataCollector &&
							enableDataCollection &&
							this.workspaceManager !== void 0 &&
							(this._logger.debug("Enabling Hindsight Data"),
							(this._dataCollector = new DataCollector(
								this._apiServer,
								this.workspaceManager,
								this._recentInstructions,
								this._recentCompletions,
								this._recentNextEditResults,
							)))
					let isNextEditEnabled = y_(newConfig, this.featureFlagManager.currentFlags.vscodeNextEditMinVersion),
						isPreviousNextEditEnabled = previousConfig && y_(previousConfig, this.featureFlagManager.currentFlags.vscodeNextEditMinVersion)
					if (isNextEditEnabled && !isPreviousNextEditEnabled)
						if (
							this.workspaceManager &&
							this.keybindingWatcher &&
							this._suggestionManager &&
							this._nextEditRequestManager
						)
							try {
								;(this._backgroundNextEdit = new BackgroundNextEdit(
									this.workspaceManager,
									this._nextEditSessionEventReporter,
									this.keybindingWatcher,
									this._configListener,
									this._suggestionManager,
									this._nextEditRequestManager,
									this._globalState,
									this.nextEditConfigManager,
									toolUseRequestEventReporter,
								)),
									this.disposeOnDisable.push(this._backgroundNextEdit),
									this._nextEditSessionEventReporter.reportEventWithoutIds(
										"initialization-success",
										"validation-expected",
									)
							} catch (error) {
								this._logger.error("Error initializing background next edit: ", error),
									this._nextEditSessionEventReporter.reportEventWithoutIds(
										"initialization-failure",
										"error",
									),
									this._apiServer.reportError(
										null,
										"background_next_edit_initialization_failure",
										error instanceof Error ? error.stack || error.message : String(error),
										[],
									)
							}
						else {
							this._logger.error("Failed to enable background next edit generation"),
								this._nextEditSessionEventReporter.reportEventWithoutIds(
									"initialization-skip",
									"validation-unexpected",
								)
							let errorDetails = [
								["this.workspaceManager", this.workspaceManager],
								["this.keybindingWatcher", this.keybindingWatcher],
								["this._suggestionManager", this._suggestionManager],
								["this._nextEditRequestManager", this._nextEditRequestManager],
							]
								.map((detail) => detail.join("="))
								.join(", ")
							this._apiServer.reportError(
								null,
								"background_next_edit_initialization_failure",
								`Background next edit initialization failed because ${errorDetails}`,
								[],
							)
						}
					else
						this._backgroundNextEdit && !isNextEditEnabled
							? (this._backgroundNextEdit.dispose(),
								(this._backgroundNextEdit = void 0),
								this._nextEditSessionEventReporter.reportEventWithoutIds(
									"disposed",
									"validation-expected",
								))
							: !isNextEditEnabled &&
								!isPreviousNextEditEnabled &&
								this._nextEditSessionEventReporter.reportEventWithoutIds(
									"initialization-skip",
									"validation-expected",
								)
					let isNextEditConfigChanged = Rl(newConfig, this.featureFlagManager.currentFlags.vscodeNextEditMinVersion ?? "")
					isNextEditConfigChanged &&
						previousConfig &&
						newConfig.nextEdit.enableBackgroundSuggestions !== previousConfig.nextEdit.enableBackgroundSuggestions &&
						this._nextEditSessionEventReporter.reportEventWithoutIds(
							newConfig.nextEdit.enableBackgroundSuggestions
								? "background-suggestions-enabled"
								: "background-suggestions-disabled",
							"unknown",
						),
						isNextEditConfigChanged &&
							previousConfig &&
							newConfig.nextEdit.highlightSuggestionsInTheEditor !==
								previousConfig.nextEdit.highlightSuggestionsInTheEditor &&
							this._nextEditSessionEventReporter.reportEventWithoutIds(
								newConfig.nextEdit.highlightSuggestionsInTheEditor
									? "highlights-enabled"
									: "highlights-disabled",
								"unknown",
							)
				}
			this.disposeOnDisable.push(
				this._configListener.onDidChange((configChange) => {
					updateCompletionState(configChange.newConfig, configChange.previousConfig)
				}),
			),
				updateCompletionState(this._configListener.config)
		}
		{
			let reporters = [
				this._completionAcceptanceReporter,
				this._codeEditReporter,
				this._nextEditResolutionReporter,
				this._nextEditSessionEventReporter,
				this._onboardingSessionEventReporter,
				this._clientMetricsReporter,
				this._completionTimelineReporter,
				this._agentSessionEventReporter,
				this._agentRequestEventReporter,
				this._extensionEventReporter,
				this._toolUseRequestEventReporter,
			]
			for (let reporter of reporters) reporter.enableUpload(), this.disposeOnDisable.push(reporter)
		}
		this.disposeOnDisable.push(
			je.window.registerWebviewViewProvider(
				"augment-next-edit",
				new NextEditWebviewProvider(
					this._configListener,
					this.featureFlagManager,
					(webviewView) =>
						new NextEditView(
							this._extensionContext.extensionUri,
							webviewView,
							webviewView.webview,
							this._suggestionManager,
							this._globalNextEdit,
							this._editorNextEdit,
							this._nextEditSessionEventReporter,
							workspaceContext,
							this._nextEditVSCodeToWebviewMessage,
						),
				),
				{ webviewOptions: { retainContextWhenHidden: !0 } },
			),
		),
			(this.enabled = !0),
			this._statusBar.setState(Fxe),
			this.disposeOnDisable.push(new StatusBarSyncingEnabledTracker(this._statusBar, this._syncingEnabledTracker))
		let actionsModelUpdater = new ActionsModelUpdater(this._configListener, this._actionsModel)
		this.addDisposable(actionsModelUpdater), actionsModelUpdater.checkAndUpdateState()
		let workspaceContextUpdater = new WorkspaceContextUpdater(this._actionsModel, this.workspaceManager)
		this.disposeOnDisable.push(workspaceContextUpdater),
			this._syncLastEnabledExtensionVersion(),
			this._extensionEventReporter.reportConfiguration(
				"configuration-snapshot",
				this._configListener.config,
				this.featureFlagManager.currentFlags,
			)
	}
	async _fetchFeatureFlags(cancellationToken) {
		try {
			return (await this._getModelConfig(cancellationToken)).featureFlags
		} catch (error) {
			this._logger.error("Failed to fetch feature flags: ", error)
			return
		}
	}
	updateModelInfo(modelInfo) {
		if (!this._modelInfo) throw new Error("Model info not set")
		modelInfo.suggestedPrefixCharCount !== void 0 &&
			(this._modelInfo.suggestedPrefixCharCount = modelInfo.suggestedPrefixCharCount),
			modelInfo.suggestedSuffixCharCount !== void 0 &&
				(this._modelInfo.suggestedSuffixCharCount = modelInfo.suggestedSuffixCharCount),
			(this._modelInfo.completionTimeoutMs = modelInfo.completionTimeoutMs)
	}
	async _getModelConfig(cancellationToken) {
		let retryDelay = 1e3,
			modelConfig,
			retryCount = 0,
			maxRetries = 6,
			statusBarUpdater = new StatusBarUpdater(this._statusBar)
		try {
			for (;;) {
				if (cancellationToken.isCancellationRequested) throw new je.CancellationError()
				try {
					this._logger.info("Retrieving model config"),
						(modelConfig = await this._apiServer.getModelConfig()),
						this._logger.info("Retrieved model config")
				} catch (error) {
					if (
						(this._logger.error("Failed to retrieve model config: ", error),
						kr.isAPIErrorWithStatus(error, He.unauthenticated))
					)
						throw error
					if (error instanceof Yp) throw error
					retryCount++
				}
				if (cancellationToken.isCancellationRequested)
					throw (this._logger.info("Model config retrieval cancelled"), new je.CancellationError())
				if (modelConfig !== void 0) return this._logger.info("Returning model config"), modelConfig
				retryCount >= maxRetries && statusBarUpdater.setState(t8),
					this._logger.info(`Retrying model config retrieval in ${retryDelay} msec`),
					await Kl(retryDelay),
					(retryDelay = Math.min(retryDelay * 2, e.modelConfigBackoffMsecMax))
			}
		} finally {
			statusBarUpdater.dispose()
		}
	}
	disable() {
		for (this.enabled = !1; this.disposeOnDisable.length; ) this.disposeOnDisable.pop().dispose()
		;(this._currentChatExtensionEventDisposable = void 0), this.reset()
	}
	reset() {
		this._enableCancel?.cancel(),
			this._enableCancel?.dispose(),
			(this._enableCancel = void 0),
			this._statusBar.reset(),
			this.workspaceManager?.dispose(),
			(this.workspaceManager = void 0),
			this._disableDataCollection()
	}
	_checkInlineCompletionsEnabled(configChange) {
		;(configChange &&
			configChange.previousConfig.completions.addIntelliSenseSuggestions ===
				configChange.newConfig.completions.addIntelliSenseSuggestions) ||
			this._enableInlineCompletions()
	}
	_enableInlineCompletions() {
		if (
			(this._disableInlineCompletions(),
			this._logger.debug("Registering inline completions provider."),
			(this._inlineCompletionProvider = new InlineCompletionProvider(
				this._completionsModel,
				this._completionAcceptanceReporter,
				this._statusBar,
				this._configListener,
				this._completionTimelineReporter,
			)),
			this._completionDisposables.push(this._inlineCompletionProvider),
			Mc((completion) => {
				completion && this._recentCompletions.addItem(completion)
			}),
			this._completionDisposables.push(
				je.languages.registerInlineCompletionItemProvider("*", this._inlineCompletionProvider),
			),
			this._configListener.config.completions.addIntelliSenseSuggestions)
		) {
			this._logger.debug("Registering completion items provider.")
			let completionItemProvider = new CompletionItemProvider(this._configListener)
			this._completionDisposables.push(
				je.languages.registerCompletionItemProvider(completionItemProvider.languageSelector, completionItemProvider, ...completionItemProvider.triggerCharacters),
			)
		}
	}
	_disableInlineCompletions() {
		for (let disposable of this._completionDisposables) disposable.dispose()
		this._completionDisposables = []
	}
	_disableDataCollection() {
		this._dataCollector?.dispose(), (this._dataCollector = void 0)
	}
	getRecencyInfo() {
		let recencyInfo = {},
			tabSwitchEvents = this.workspaceManager.getTabSwitchEvents()
		return (
			tabSwitchEvents !== void 0 &&
				(recencyInfo.tab_switch_events = tabSwitchEvents.map((event) => ({
					path: event.relPathName,
					file_blob_name: event.blobName,
				}))),
			recencyInfo
		)
	}
	forceNextEditSuggestion(suggestion) {
		let activeEditor = je.window.activeTextEditor
		if (!activeEditor || !this.workspaceManager) return
		let resolvedPath = this.workspaceManager.safeResolvePathName(activeEditor.document.uri)
		resolvedPath &&
			(this._nextEditSessionEventReporter.reportEventWithoutIds("suggestion-forced", suggestion ?? "command"),
			this._nextEditRequestManager?.enqueueRequest(resolvedPath, "FORCED", "CURSOR", $u(activeEditor.selection)))
	}
	nextEditUpdate(update) {
		this._globalNextEdit?.startGlobalQuery(update)
	}
	nextEditBackgroundSuggestionsEnabled() {
		return y_(
			this._configListener.config,
			this.featureFlagManager.currentFlags.vscodeNextEditMinVersion ?? "",
		)
	}
	noopClicked() {
		this._nextEditSessionEventReporter.reportEventWithoutIds("noop-clicked", "command")
	}
	nextEditTogglePanelHorizontalSplit(command) {
		this._nextEditVSCodeToWebviewMessage.fire({
			type: "next-edit-toggle-suggestion-tree",
		}),
			this._nextEditSessionEventReporter.reportEventWithoutIds("toggle-panel-horizontal-split", command ?? "command")
	}
	openNextEditPanel(command) {
		this._nextEditSessionEventReporter.reportEventWithoutIds("panel-focus-executed", command ?? "command"),
			je.commands.executeCommand("augment-next-edit.focus"),
			this._nextEditVSCodeToWebviewMessage.fire({
				type: "next-edit-panel-focus",
			})
	}
	nextEditLearnMore(command) {
		this._nextEditSessionEventReporter.reportEventWithoutIds("learn-more-clicked", command ?? "command"),
			je.env.openExternal(je.Uri.parse("https://docs.augmentcode.com/using-augment/next-edit"))
	}
	async updateStatusTrace() {
		this._statusTrace?.dispose()
		let statusTrace = new StatusTrace(() => this._onTextDocumentDidChange.fire(AugmentExtension.displayStatusUri))
		this._statusTrace = statusTrace
		let statusLine = 0
		if (this.enableInProgress) {
			statusTrace.addLine("Augment extension is initializing"), statusTrace.publish()
			return
		}
		if (!this.enabled) {
			statusTrace.addLine("Augment is not enabled in this workspace"), statusTrace.publish()
			return
		}
		statusTrace.addSection("Extension version")
		let extensionInfo = je.extensions.getExtension("augment.vscode-augment")
		extensionInfo ? statusTrace.addValue("Extension version", extensionInfo.packageJSON.version) : statusTrace.addLine("Cannot retrieve extension version"),
			statusTrace.addSection("Session ID"),
			statusTrace.addValue("Session ID", this._apiServer.sessionId),
			statusTrace.addSection("Recent Completion Requests (oldest to newest)")
		let recentCompletionItems = this._recentCompletions.items.sort((a, b) => a.occuredAt.getTime() - b.occuredAt.getTime()).slice(0, 10)
		for (let { requestId } of recentCompletionItems) statusTrace.addLine(`${requestId}`)
		recentCompletionItems.length === 0 && statusTrace.addLine("No recent completion requests"),
			statusTrace.addSection("Recent Instruction Requests (oldest to newest)")
		for (let { requestId } of this._recentInstructions.items) statusTrace.addLine(`${requestId}`)
		this._recentInstructions.items.length === 0 && statusTrace.addLine("No recent instruction requests"),
			statusTrace.addSection("Recent Chat Requests (oldest to newest)")
		for (let { requestId } of this._recentChats.items) statusTrace.addLine(`${requestId}`)
		this._recentChats.items.length === 0 && statusTrace.addLine("No recent chat requests"),
			statusTrace.addSection("Extension configuration")
		let config = this._configListener.config
		statusTrace.addObject(config), statusTrace.addValue("Using API token", !this._auth.useOAuth)
		let tenantUrl = ""
		if (this._auth.useOAuth) {
			let session = await this._auth.getSession()
			statusTrace.addValue("Tenant URL", session?.tenantURL), (tenantUrl = session?.tenantURL || "")
		} else tenantUrl = config.completionURL
		if (!this.ready) {
			statusTrace.addLine("Augment extension is initializing"), statusTrace.publish()
			return
		}
		statusTrace.addSection("Back-end Configuration"),
			statusTrace.addValue("MaxUploadSizeBytes", this.featureFlagManager.currentFlags.maxUploadSizeBytes),
			statusTrace.addValue(
				"enableCompletionFileEditEvents",
				this.featureFlagManager.currentFlags.enableCompletionFileEditEvents,
			),
			statusTrace.addSection("Supported languages (Augment name / VSCode name):")
		for (let language of this._languages) statusTrace.addLine(`${language.name} / ${language.vscodeName}`)
		statusTrace.addSection("Available Models")
		for (let model of this._availableModels) {
			let isDefaultModel = this._defaultModel && model.startsWith(this._defaultModel),
				isCurrentModel = (!config.modelName && isDefaultModel) || model === config.modelName,
				modelDisplayName = model + (isDefaultModel ? " (default)" : "") + (isCurrentModel ? " (current)" : "")
			statusTrace.addLine(modelDisplayName)
		}
		this._availableModels.length === 0 && statusTrace.addLine("No models available"),
			statusTrace.addSection("Current Model"),
			(statusLine = statusTrace.savePoint()),
			statusTrace.addLine("Querying current model"),
			statusTrace.addLine("(in progress...)")
		try {
			statusTrace.publish(), statusTrace.rollback(statusLine), config.modelName || statusTrace.addLine("(Using default model)"), statusTrace.addObject(this.modelInfo)
		} catch (error) {
			statusTrace.rollback(statusLine),
				error instanceof ModelNotFoundError
					? statusTrace.addLine(`Model "${config.modelName}" not known.`)
					: statusTrace.addError(`Unable to query info about model "${config.modelName}": ${Ye(error)}`)
		}
		if (
			(statusTrace.addSection("Blob upload"),
			config.enableUpload
				? statusTrace.addLine("Blob upload enabled in configuration settings")
				: statusTrace.addLine("Blob upload disabled in configuration settings"),
			this.workspaceManager !== void 0 && (await this.workspaceManager.updateStatusTrace(statusTrace)),
			tenantUrl !== "")
		) {
			statusTrace.addSection("Completion status"), statusTrace.addLine(`Attempting completion from ${tenantUrl}`)
			let requestId = this._apiServer.createRequestId()
			statusTrace.addValue("Request ID", requestId), (statusLine = statusTrace.savePoint()), statusTrace.addLine("(in progress...)")
			try {
				statusTrace.publish()
				let startTime = Date.now(),
					completionResponse = await this._apiServer.complete(
						requestId,
						"this is the prefix",
						"this is the suffix",
						"/this/is/the/path",
						void 0,
						{ prefixBegin: 0, cursorPosition: 0, suffixEnd: 0 },
						"python",
						{ checkpointId: void 0, addedBlobs: [], deletedBlobs: [] },
						[],
					)
				statusTrace.rollback(statusLine),
					statusTrace.addLine(`Response received in ${Date.now() - startTime} ms`),
					completionResponse.completionItems.length === 0
						? statusTrace.addLine("No completion received")
						: statusTrace.addLine(`${completionResponse.completionItems.length} completion(s) received`)
			} catch (error) {
				statusTrace.rollback(statusLine), statusTrace.addError(`Completion request failed: ${error}`)
			}
		}
		statusTrace.addSection("Feature Flags"), statusTrace.addObject(this.featureFlagManager.currentFlags), statusTrace.publish()
	}
	async provideTextDocumentContent(uri) {
		return uri.toString() === AugmentExtension.displayStatusUri.toString()
			? this._statusTrace === void 0
				? "Internal error. Cannot get Augment extension status."
				: this._statusTrace.content
			: ""
	}
	get onDidChange() {
		return this._onTextDocumentDidChange.event
	}
	clearFileEdits() {
		this.workspaceManager?.clearFileEdits()
	}