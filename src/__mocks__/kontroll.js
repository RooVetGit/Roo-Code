// Mock implementation of kontroll's countdown function
module.exports = {
	countdown: (delay, callback, options = {}) => {
		// Simple mock that just calls the callback immediately
		setTimeout(callback, 0)
		return () => {} // Return a no-op cleanup function
	},
}
