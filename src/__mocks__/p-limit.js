const pLimit = (concurrency) => async (fn) => fn()

module.exports = pLimit
