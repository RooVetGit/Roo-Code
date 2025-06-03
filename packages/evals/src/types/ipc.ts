
// import { IpcMessageType, taskEventSchema } from "@roo-code/types"

/**
 * TaskEvent
 */

export enum EvalEventName {
	Pass = "pass",
	Fail = "fail",
}

// export const taskEventSchema = z.discriminatedUnion("eventName", [
// 	...taskEventSchema.shape,
// 	z.object({
// 		eventName: z.literal(EvalEventName.Pass),
// 		payload: z.undefined(),
// 		taskId: z.number(),
// 	}),
// 	z.object({
// 		eventName: z.literal(EvalEventName.Fail),
// 		payload: z.undefined(),
// 		taskId: z.number(),
// 	}),
// ])

/**
 * IpcMessage
 */

// export enum IpcMessageType {
// 	...,
// 	TaskEvent = "TaskEvent",
// 	EvalEvent = "EvalEvent",
// }
