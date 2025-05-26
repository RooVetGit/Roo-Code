// Mock implementation of execa
module.exports = {
	execa: jest.fn().mockResolvedValue({
		stdout: "",
		stderr: "",
		exitCode: 0,
	}),
	execaSync: jest.fn().mockReturnValue({
		stdout: "",
		stderr: "",
		exitCode: 0,
	}),
}
