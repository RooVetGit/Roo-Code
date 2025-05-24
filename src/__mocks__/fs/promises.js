const mockStat = jest.fn()
const mockReaddir = jest.fn()
const mockReadFile = jest.fn()
const mockMkdir = jest.fn()
const mockWriteFile = jest.fn()

// Mock directories set
const _mockDirectories = new Set()

// Initialize mock data
const _setInitialMockData = () => {
	_mockDirectories.clear()
}

module.exports = {
	stat: mockStat,
	readdir: mockReaddir,
	readFile: mockReadFile,
	mkdir: mockMkdir,
	writeFile: mockWriteFile,
	_mockDirectories,
	_setInitialMockData,
}
