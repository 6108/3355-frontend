// 가짜 STOMP 용 간단한 pub/sub. (WebSocket 서버 역할)

type Listener = (body: string) => void;

const listeners = new Map<string, Set<Listener>>();

export function busSubscribe(destination: string, cb: Listener) {
  if (!listeners.has(destination)) listeners.set(destination, new Set());
  listeners.get(destination)!.add(cb);
  return () => {
    listeners.get(destination)?.delete(cb);
  };
}

export function busEmit(destination: string, payload: unknown) {
  const body = JSON.stringify(payload);
  listeners.get(destination)?.forEach((cb) => cb(body));
}
