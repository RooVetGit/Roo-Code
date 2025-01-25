// Silence console output during tests
console.log = () => {}
console.info = () => {}
console.warn = () => {}
console.error = () => {}
process.env.NODE_NO_WARNINGS = "1"
