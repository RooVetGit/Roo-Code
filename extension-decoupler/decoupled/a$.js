
var xv = class {
		static _instance = void 0
		static setPluginFileStore(t) {
			if (this._instance !== void 0) {
				dn("PluginFileStore").warn(
					"Attempting to initialize client workspaces when one is already configured. Keeping existing client workspaces.",
				)
				return
			}
			this._instance = t
		}
		static getPluginFileStore() {
			if (this._instance === void 0) throw new Error("ClientWorkspaces not set")
			return this._instance
		}
		static reset() {
			this._instance = void 0
		}
	},
	p$ = (e) => xv.setPluginFileStore(e),
	lI = () => xv.getPluginFileStore(),
	A$ = () => xv.reset()