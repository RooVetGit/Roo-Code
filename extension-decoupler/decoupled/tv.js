
var Tv = class {
		static _instance = void 0
		static setAPIClient(t) {
			if (this._instance !== void 0) {
				dn("APICLient").warn(
					"Attempting to initialize API clientwhen one is already configured. Keeping existing client workspaces.",
				)
				return
			}
			this._instance = t
		}
		static getAPIClient() {
			if (this._instance === void 0) throw new Error("API Client not set")
			return this._instance
		}
		static reset() {
			this._instance = void 0
		}
	},
	cY = (e) => Tv.setAPIClient(e),
	Rf = () => Tv.getAPIClient(),
	uY = () => Tv.reset()