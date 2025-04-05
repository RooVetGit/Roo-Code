export const telemetryService = {
	captureTaskCreated: jest.fn(),
	captureTaskRestarted: jest.fn(),
	captureTaskCompleted: jest.fn(),
	captureError: jest.fn(),
}
