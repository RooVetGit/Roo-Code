
var Rv = class {
		static _instance = void 0
		static setWebviewMessagingClient(t) {
			if (this._instance !== void 0) {
				dn("WebviewMessages").warn(
					"Attempting to initialize webview messages when one is already configured. Keeping existing webview message client.",
				)
				return
			}
			this._instance = t
		}
		static getWebviewMessagingClient() {
			if (this._instance === void 0) throw new Error("Webview messaging client not set")
			return this._instance
		}
		static reset() {
			this._instance = void 0
		}
	},
	dY = (e) => Rv.setWebviewMessagingClient(e),
	CMe = () => Rv.getWebviewMessagingClient(),
	fY = () => Rv.reset()