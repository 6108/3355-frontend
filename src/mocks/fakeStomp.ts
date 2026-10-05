// @stomp/stompjs 의 Client 중 ChatPage 가 쓰는 부분만 흉내낸 가짜 클라이언트.
// 실제 WebSocket 서버(wss://ws.zony.kro.kr/chat) 없이도 채팅이 동작한다.

import type { IFrame, IMessage, StompSubscription } from '@stomp/stompjs';
import { busEmit, busSubscribe } from './bus';
import { MOCK_BOT_REPLY, MOCK_USER_ID, MOCK_USER_NICKNAME, MOCK_WS_DELAY } from './config';
import { BOT_REPLIES, FAKE_USERS, addMessage } from './db';

type MockStompConfig = {
  brokerURL?: string;
  connectHeaders?: Record<string, string>;
  onConnect?: (frame: IFrame) => void;
  [key: string]: unknown;
};

export class MockStompClient {
  active = false;
  connected = false;

  private config: MockStompConfig;
  private unsubs = new Set<() => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private subCounter = 0;

  constructor(config: MockStompConfig = {}) {
    this.config = config;
  }

  activate() {
    this.active = true;
    this.later(() => {
      this.connected = true;
      this.config.onConnect?.({} as IFrame);
    }, MOCK_WS_DELAY);
  }

  async deactivate() {
    this.active = false;
    this.connected = false;
    this.unsubs.forEach((off) => off());
    this.unsubs.clear();
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  }

  subscribe(destination: string, callback: (message: IMessage) => void): StompSubscription {
    const off = busSubscribe(destination, (body) => callback({ body } as IMessage));
    this.unsubs.add(off);
    this.subCounter += 1;
    return {
      id: `mock-sub-${this.subCounter}`,
      unsubscribe: () => {
        off();
        this.unsubs.delete(off);
      },
    };
  }

  publish(params: { destination: string; body?: string; headers?: Record<string, string> }) {
    const send = params.destination.match(/^\/app\/chat-rooms\/(.+)\/send$/);
    if (!send) return; // join 등은 목업에서 할 일 없음

    const roomId = send[1];
    let content = '';
    try {
      content = String(JSON.parse(params.body ?? '{}').content ?? '').trim();
    } catch {
      /* ignore */
    }
    if (!content) return;

    // 내가 보낸 메시지를 서버가 방송하는 것처럼 되돌려준다
    const mine = addMessage(roomId, { userId: MOCK_USER_ID, nickname: MOCK_USER_NICKNAME, content });
    this.later(() => busEmit(`/sub/chat-rooms/${roomId}`, mine), 60);

    if (MOCK_BOT_REPLY) this.scheduleBotReply(roomId);
  }

  private scheduleBotReply(roomId: string) {
    this.later(() => {
      const user = FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
      const content = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
      const reply = addMessage(roomId, { userId: user.userId, nickname: user.nickname, content });
      busEmit(`/sub/chat-rooms/${roomId}`, reply);
    }, 1200 + Math.random() * 1500);
  }

  private later(fn: () => void, ms: number) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      if (this.active) fn();
    }, ms);
    this.timers.add(t);
  }
}
