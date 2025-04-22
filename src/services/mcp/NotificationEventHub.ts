import { EventEmitter } from "events"
import { ASK_REPLY_EVENT, Event } from "./types.js"

export class NotificationEventHub {
	private subscribers: Map<string, EventEmitter>

	constructor() {
		this.subscribers = new Map()
	}

	subscribe(clientId: string): EventEmitter {
		const emitter = new EventEmitter()
		this.subscribers.set(clientId, emitter)
		return emitter
	}

	unsubscribe(clientId: string): void {
		const emitter = this.subscribers.get(clientId)
		if (emitter) {
			emitter.removeAllListeners()
			this.subscribers.delete(clientId)
		}
	}

	distribute(event: Event): void {
		for (const emitter of this.subscribers.values()) {
			emitter.emit(ASK_REPLY_EVENT, event)
		}
	}
}
