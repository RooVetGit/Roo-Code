
function ECt(e) {
	let t = X("activate()")
	t.debug("======== Activating extension ========")
	let r
	function n(K) {
		K.enable()
	}
	function i(K) {
		K.disable()
	}
	function s() {
		r && (t.debug("======== Deactivating extension ========"), i(r)), (r = void 0)
	}
	function o() {
		t.info("======== Reloading extension ========"), i(r), n(r)
	}
	e.subscriptions.push(
		new je.Disposable(() => {
			s()
		}),
	),
		e.subscriptions.push(
			je.window.registerUriHandler({
				handleUri(K) {
					if (K.authority.toLowerCase() !== e.extension.id.toLowerCase()) {
						t.warn(`Ignoring URI ${K.toString()}`)
						return
					}
					switch (K.path) {
						case q.authRedirectURI.path:
							q.handleAuthURI(K)
							break
						default:
							t.error(
								`Unhandled URI ${je.Uri.from({
									scheme: K.scheme,
									authority: K.authority,
									path: K.path,
								}).toString()}`,
							)
					}
				},
			}),
		)
	let a = `${kN.default.platform()}; ${kN.default.arch()}; ${kN.default.release()}`,
		l = `${e.extension.id}/${e.extension.packageJSON.version} (${a}) ${je.env.uriScheme}/${je.version}`,
		c = new mk(e),
		u = Rwe(c),
		f = new sk()
	f.migrateLegacyConfig()
	let p = new lk(e, f)
	e.subscriptions.push(p)
	let g = new OQ()
	e.subscriptions.push(g)
	let m = new ik(f, p, u, l, global.fetch),
		y = new B1(),
		C = new eg(10),
		v = new eg(10),
		b = new eg(10),
		w = new je.EventEmitter(),
		B = new je.EventEmitter(),
		M = new je.EventEmitter(),
		Q = new je.EventEmitter(),
		O = new eM(e),
		Y = new MQ(e.extensionUri)
	Y.onVisibilityChange((K) => {
		K || eC.currentPanel?.dispose()
	})
	let j = new F1(c)
	e.subscriptions.push(j)
	let ne = new K1(m),
		q = new uk(e, f, m, p, ne),
		me = new L1(m, f, q, j)
	function Qe(K) {
		e: for (let se of K)
			switch (se.name) {
				case "UserShouldSignIn": {
					Y.changeApp(me), N()
					break e
				}
				case "WorkspaceNotSelected": {
					j.isSystemStateComplete("authenticated") && (M.fire("folder-selection"), N())
					break e
				}
				case "ShouldDisableCopilot":
				case "ShouldDisableCodeium":
				case "SyncingPermissionNeeded":
				case "uploadingHomeDir":
				case "workspaceTooLarge":
					N()
					break e
			}
		;(j.isDerivedStateSatisfied("SyncingPermissionNeeded") ||
			j.isDerivedStateSatisfied("uploadingHomeDir") ||
			j.isDerivedStateSatisfied("workspaceTooLarge")) &&
			M.fire("awaiting-syncing-permission")
	}
	e.subscriptions.push(
		p.onDidChangeSession(() => {
			o()
		}),
	),
		e.subscriptions.push(new ok(j, p, f)),
		e.subscriptions.push(
			je.window.registerWebviewViewProvider("augment-chat", Y, {
				webviewOptions: { retainContextWhenHidden: !0 },
			}),
		),
		(r = new AA(e, c, f, m, p, y, C, b, v, w, Q, Y, M, j, g, B, ne, O))
	function N() {
		Y.isVisible() || je.commands.executeCommand(Hi.commandID)
	}
	e.subscriptions.push(j.onDerivedStatesSatisfied(Qe)),
		Qe(j.satisfiedStates),
		f.onDidChange((K) => {
			K.newConfig.enableDebugFeatures, K.previousConfig.enableDebugFeatures
		}),
		e.subscriptions.push(
			f.onDidChange((K) => {
				let se = !1,
					Ze = ["apiToken", "completionURL", "oauth", "modelName"]
				for (let It of Ze)
					if (!(0, E6.default)(K.previousConfig[It], K.newConfig[It])) {
						se = !0
						break
					}
				se && (t.info("Reloading extension due to config change"), o())
			}),
		),
		e.subscriptions.push(je.workspace.registerTextDocumentContentProvider(AA.contentScheme, r)),
		kwe(r, f, e)
	let re = Bxe(e, r, f, p, q, m, y, C, b, M, B, g, c)
	e.subscriptions.push(re), e.subscriptions.push(Q), n(r)
}