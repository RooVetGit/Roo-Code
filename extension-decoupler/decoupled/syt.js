
var Syt = "file-edit-events.json",
	WQ = class {
		save(t) {
			return Promise.resolve()
		}
		load() {
			return Promise.resolve([])
		}
		clear() {}
	},
	GQ = class {
		_logger = X("FileEditEventsStore")
		_version = "1"
		_storeFile
		constructor(t) {
			this._logger.debug(`Using [${t.directory}] to store events`), (this._storeFile = $t(t.directory, Syt))
		}
		save(t) {
			this._logger.debug(`Saving ${t.length} events to ${this._storeFile}`),
				lme(this._storeFile, JSON.stringify({ version: this._version, events: t }))
		}
		async load() {
			this._logger.debug(`Loading events from ${this._storeFile}`)
			try {
				if (!Pn(this._storeFile))
					return this._logger.debug(`File ${this._storeFile} does not exist. Not loading events.`), []
				let t = await Fr(this._storeFile),
					r = JSON.parse(t)
				return r.version !== this._version
					? (this._logger.debug(
							`Version mismatch: ${r.version} !== ${this._version}. Not loading events from ${this._storeFile}`,
						),
						[])
					: (this._logger.debug(`Loaded ${r.events.length} events from ${this._storeFile}`), r.events)
			} catch (t) {
				return this._logger.debug(`Failed to load events from ${this._storeFile}`, t), []
			}
		}
		clear() {
			this.save([])
		}
	}