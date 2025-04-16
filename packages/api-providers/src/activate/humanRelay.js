// Callback mapping of human relay response.
const humanRelayCallbacks = new Map()
/**
 * Register a callback function for human relay response.
 * @param requestId
 * @param callback
 */
export const registerHumanRelayCallback = (requestId, callback) => humanRelayCallbacks.set(requestId, callback)
export const unregisterHumanRelayCallback = (requestId) => humanRelayCallbacks.delete(requestId)
export const handleHumanRelayResponse = (response) => {
	const callback = humanRelayCallbacks.get(response.requestId)
	if (callback) {
		if (response.cancelled) {
			callback(undefined)
		} else {
			callback(response.text)
		}
		humanRelayCallbacks.delete(response.requestId)
	}
}
//# sourceMappingURL=humanRelay.js.map
