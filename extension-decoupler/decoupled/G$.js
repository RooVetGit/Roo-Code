
function g$(e) {
	if (bv) {
		bv.warn("Attempting to initialize logger when one is already configured. Keeping existing logger.")
		return
	}
	bv = e
}