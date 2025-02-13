async function core() {
	return {
		size: 1000,
		errors: [],
	}
}
core.loose = core
core.strict = core
module.exports = core
