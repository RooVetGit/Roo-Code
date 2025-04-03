
var WG = class {
		unexpectedErrorHandler
		listeners
		constructor() {
			;(this.listeners = []),
				(this.unexpectedErrorHandler = function (t) {
					setTimeout(() => {
						throw t.stack
							? NF.isErrorNoTelemetry(t)
								? new NF(
										t.message +
											`

` +
											t.stack,
									)
								: new Error(
										t.message +
											`

` +
											t.stack,
									)
							: t
					}, 0)
				})
		}
		addListener(t) {
			return (
				this.listeners.push(t),
				() => {
					this._removeListener(t)
				}
			)
		}
		emit(t) {
			this.listeners.forEach((r) => {
				r(t)
			})
		}
		_removeListener(t) {
			this.listeners.splice(this.listeners.indexOf(t), 1)
		}
		setUnexpectedErrorHandler(t) {
			this.unexpectedErrorHandler = t
		}
		getUnexpectedErrorHandler() {
			return this.unexpectedErrorHandler
		}
		onUnexpectedError(t) {
			this.unexpectedErrorHandler(t), this.emit(t)
		}
		onUnexpectedExternalError(t) {
			this.unexpectedErrorHandler(t)
		}
	},
	bqt = new WG()