
var ck = "augment.oauth-state",
	Uct = ".augmentcode.com",
	HAe = 10,
	/**
	 * @classdesc Handles the Augment OAuth flow.
	 * This class is responsible for handling the OAuth flow with the Augment server.
	 * It provides methods to start the OAuth flow, handle the redirect back to the extension,
	 * and get the access token from the redirect.
	 * @example
	 * const augmentOAuth = new uk(context, config, apiServer, authSession, onboardingSessionEventReporter)
	 * const authUrl = await augmentOAuth.getOAuthUrl()
	 * const token = await augmentOAuth.getTokenFromRedirect(url)
	 */
	uk = class {
		constructor(t, r, n, i, s) {
			this._context = t
			this._config = r
			this._apiServer = n
			this._authSession = i
			this._onboardingSessionEventReporter = s
			this.authRedirectURI = fo.Uri.from({
				scheme: fo.env.uriScheme,
				authority: this._context.extension.id,
				path: "/auth/result",
			})
		}
		_logger = X("OAuthFlow")
		_programmaticCancellation = new fo.EventEmitter()
		_previousLogin
		authRedirectURI
		doProgrammaticCancellation() {
			this._programmaticCancellation.fire("Cancelled by user")
		}
		async startFlow(t = !0) {
			try {
				this._programmaticCancellation.fire("Cancelled due to new sign in"),
					await Promise.allSettled([this._previousLogin]),
					this._logger.info("Creating new session...")
				let r
				t ? (r = await this.loginWithProgress()) : (r = await this.loginWithoutProgress()),
					this._logger.info(`Created session ${r.tenantURL}`),
					this._onboardingSessionEventReporter.reportEvent("signed-in")
			} catch (r) {
				throw (fo.window.showErrorMessage(`Sign in failed. ${Ye(r)}`), r)
			}
		}
		async createOAuthState() {
			let t = WAe((0, vy.randomBytes)(32)),
				r = WAe(Oct(Buffer.from(t))),
				n = (0, vy.randomUUID)(),
				i = {
					codeVerifier: t,
					codeChallenge: r,
					state: n,
					creationTime: new Date().getTime(),
				}
			return await this._context.secrets.store(ck, JSON.stringify(i)), i
		}
		async getOAuthState() {
			let t = await this._context.secrets.get(ck)
			if (t) {
				let r = JSON.parse(t)
				if (new Date().getTime() - r.creationTime < HAe * 60 * 1e3) return r
			}
			return null
		}
		async removeOAuthState() {
			;(await this._context.secrets.get(ck)) && (await this._context.secrets.delete(ck))
		}
		async loginWithoutProgress() {
			let t = new fo.CancellationTokenSource()
			return this.login(t.token)
		}
		async loginWithProgress() {
			let t = {
					location: fo.ProgressLocation.Notification,
					title: "Signing in...",
					cancellable: !0,
				},
				r = (n, i) => ((this._previousLogin = this.login(i)), this._previousLogin)
			return fo.window.withProgress(t, r)
		}
		async login(t) {
			if (!this._config.config.oauth.url) throw new Error("No OAuth URL defined.")
			let r = [
				this.waitForSessionChange(),
				new Promise((n, i) => setTimeout(() => i("Timed out"), HAe * 60 * 1e3)),
				this.waitForProgrammaticCancellation(),
				this.waitForCancellation(t, "User cancelled"),
			]
			try {
				let n = await this.createOAuthState()
				return await this.openBrowser(n), await Promise.race(r)
			} finally {
				await this.removeOAuthState()
			}
		}
		async openBrowser(t) {
			let r = ak.join(" "),
				n = new URLSearchParams({
					response_type: "code",
					code_challenge: t.codeChallenge,
					code_challenge_method: "S256",
					client_id: this._config.config.oauth.clientID || "",
					redirect_uri: this.authRedirectURI.toString(),
					state: t.state,
					scope: r,
					prompt: "login",
				}),
				i = new URL(`/authorize?${n.toString()}`, this._config.config.oauth.url),
				s = fo.Uri.parse(i.toString())
			await fo.env.openExternal(s)
		}
		async waitForSessionChange() {
			let t = await Iu(this._authSession.onDidChangeSession)
			if (!t) throw new Error("No session")
			return t
		}
		async waitForProgrammaticCancellation() {
			let t = await Iu(this._programmaticCancellation.event)
			throw new Error(t)
		}
		async waitForCancellation(t, r) {
			throw (await Iu(t.onCancellationRequested), new Error(r))
		}
		async processAuthRedirect(t) {
			let r = new URLSearchParams(t.query),
				n = r.get("state")
			if (!n) throw new Error("No state")
			let i = await this.getOAuthState()
			if (!i) throw new Error("No OAuth state found")
			if ((await this.removeOAuthState(), i.state !== n)) throw new Error("Unknown state")
			let s = r.get("error")
			if (s) {
				let l = [`(${s})`],
					c = r.get("error_description")
				throw (c && l.push(c), new Error(`OAuth request failed: ${l.join(" ")}`))
			}
			let o = r.get("code")
			if (!o) throw new Error("No code")
			let a = r.get("tenant_url")
			if (a) {
				if (!new URL(a).hostname.endsWith(Uct))
					throw new Error("OAuth request failed: invalid OAuth tenant URL")
			} else throw new Error("No tenant URL")
			try {
				let l = await this._apiServer.getAccessToken(this.authRedirectURI.toString(), a, i.codeVerifier, o)
				await this._authSession.saveSession(l, a)
			} catch (l) {
				throw (
					(this._logger.error(`Failed to get and save access token: ${Ye(l)}`),
					new Error(`If you have a firewall, please add "${a}" to your allowlist.`))
				)
			}
		}
		async handleAuthURI(t) {
			try {
				await this.processAuthRedirect(t)
			} catch (r) {
				this._logger.warn("Failed to process auth request:", r), this._programmaticCancellation.fire(Ye(r))
			}
		}
	}