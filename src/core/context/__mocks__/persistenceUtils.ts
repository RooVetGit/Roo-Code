import { PersistedContextHistory } from "../context-management/types";

// Mock functions with the same signatures as the original but with simplified types
export const readPersistedContextHistory = jest.fn(
    async (_contextProxy: any, _taskId: string): Promise<PersistedContextHistory> => {
        return {};
    }
);

export const writePersistedContextHistory = jest.fn(
    async (_contextProxy: any, _taskId: string, _history: PersistedContextHistory): Promise<void> => {
        return;
    }
);