import EventEmitter from 'events';

declare global {
  // eslint-disable-next-line no-var
  var _lumio_sse_emitter: EventEmitter | undefined;
}

const emitter: EventEmitter = global._lumio_sse_emitter ?? new EventEmitter();
if (!global._lumio_sse_emitter) global._lumio_sse_emitter = emitter;

export function sendNotificationEvent(userId: string, payload: any) {
  emitter.emit(userId, payload);
}

export function subscribeToUserEvents(userId: string, handler: (payload: any) => void) {
  emitter.on(userId, handler);
  return () => emitter.off(userId, handler);
}
