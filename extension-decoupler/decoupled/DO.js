
var wv = class {
		static _instance = void 0
		static setClientWorkspaces(t) {
			if (this._instance !== void 0) {
				dn("ClientWorkspaces").warn(
					"Attempting to initialize client workspaces when one is already configured. Keeping existing client workspaces.",
				)
				return
			}
			this._instance = t
		}
		static getClientWorkspaces() {
			if (this._instance === void 0) throw new Error("ClientWorkspaces not set")
			return this._instance
		}
		static reset() {
			this._instance = void 0
		}
	},
	b$ = (e) => wv.setClientWorkspaces(e),
	Do = () => wv.getClientWorkspaces(),
	x$ = () => wv.reset()