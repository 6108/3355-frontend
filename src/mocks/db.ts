// 메모리 DB. 새로고침하면 초기 상태로 돌아갑니다.
// 축제 데이터를 바꾸고 싶으면 아래 FESTIVAL_SEEDS 만 수정하면 됩니다.

import type { ChatAPI, FestivalAPI, RoomAPI, User } from '@/types/api';
import { MOCK_MAX_PARTICIPANTS, MOCK_USER_ID, MOCK_USER_NICKNAME } from './config';

/* ------------------------------------------------------------------ */
/* 유틸                                                                */
/* ------------------------------------------------------------------ */

const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY);

/**
 * 서버가 내려주는 시간 포맷: 타임존(Z) 없는 UTC 시각 문자열.
 * ChatItem 이 +9시간 보정을 하므로 같은 포맷으로 맞춰야 시간이 정확히 표시된다.
 */
export const toWallUtc = (d: Date) => d.toISOString().slice(0, 19);

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** 두 좌표 사이 거리(km) */
export const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/** 이미지 파일 없이도 그림이 나오도록 SVG data URI 포스터를 만든다 */
const poster = (title: string, hue: number) => {
  const text = title.length > 13 ? `${title.slice(0, 13)}…` : title;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},70%,62%)"/>` +
    `<stop offset="1" stop-color="hsl(${(hue + 55) % 360},70%,40%)"/></linearGradient></defs>` +
    `<rect width="600" height="600" fill="url(#g)"/>` +
    `<circle cx="470" cy="130" r="90" fill="white" fill-opacity="0.18"/>` +
    `<text x="36" y="540" font-size="42" font-weight="700" fill="white" font-family="sans-serif">${text}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

/* ------------------------------------------------------------------ */
/* 시드 데이터                                                         */
/* ------------------------------------------------------------------ */

type FestivalSeed = {
  id: number;
  title: string;
  region: string; // SEOUL | GYEONGGI | CHUNGCHEONG | GANGWON | GYEONGBUK | GYEONGNAM | JEOLLA | JEJU
  addr: string;
  lat: number;
  lon: number;
  start: number; // 오늘 기준 시작일 오프셋(일). 음수 = 이미 시작, 양수 = 예정
  days: number; // 기간(일)
  rooms: number[]; // 채팅방별 참여자 수. 합계가 축제 총 참여자 수가 됨 (300+ 노랑, 700+ 분홍)
};

const FESTIVAL_SEEDS: FestivalSeed[] = [
  // ── 노들섬 근처: 목업 위치(노들섬)에서 채팅/방 생성 가능 ──
  { id: 1, title: '노들섬 가을 음악회', region: 'SEOUL', addr: '서울 용산구 양녕로 445', lat: 37.5179669, lon: 126.957047, start: -2, days: 12, rooms: [100, 96, 94, 92, 90, 88, 86, 84, 48] }, // 합계 778 → 분홍, 첫 방은 만석
  { id: 2, title: '한강 야경 러닝 페스티벌', region: 'SEOUL', addr: '서울 동작구 이수교 인근', lat: 37.5185, lon: 126.959, start: -1, days: 6, rooms: [80, 70, 60, 55, 40, 35] }, // 340 → 노랑
  // ── 서울 (같은 좌표 2개: 지도에서 그룹 마커 확인용) ──
  { id: 3, title: '문화가 흐르는 서울광장', region: 'SEOUL', addr: '서울 중구 세종대로 110', lat: 37.5655015943, lon: 126.9787960237, start: -5, days: 20, rooms: [60, 44, 30] },
  { id: 4, title: '서울조각페스티벌', region: 'SEOUL', addr: '서울 중구 세종대로 110', lat: 37.5655015943, lon: 126.9787960237, start: -3, days: 14, rooms: [38, 22] },
  { id: 5, title: '종로 어디나 스테이지', region: 'SEOUL', addr: '서울 종로구 종로 일대', lat: 37.5720618985, lon: 126.9763210635, start: 5, days: 9, rooms: [12, 8] },
  { id: 6, title: 'DDP 건축투어', region: 'SEOUL', addr: '서울 중구 을지로 281', lat: 37.566107632, lon: 127.0095709797, start: -10, days: 30, rooms: [41, 27, 19] },
  { id: 7, title: '광무대 목요풍류', region: 'SEOUL', addr: '서울 종로구 창신동', lat: 37.5708709408, lon: 127.008107089, start: 12, days: 3, rooms: [6] },
  { id: 8, title: '남산 봉수의식 전통문화행사', region: 'SEOUL', addr: '서울 중구 남산공원길', lat: 37.5698206245, lon: 126.9836898995, start: -1, days: 4, rooms: [33, 21] },
  // ── 경기/인천 ──
  { id: 9, title: '구리 코스모스 빛 축제', region: 'GYEONGGI', addr: '경기 구리시 한강로 일대', lat: 37.5825191614, lon: 127.1386448674, start: -4, days: 16, rooms: [52, 40, 18] },
  { id: 10, title: '쏙쏙들이 페스티벌', region: 'GYEONGGI', addr: '경기 파주시 탄현면', lat: 37.7833378215, lon: 126.6946991484, start: 7, days: 5, rooms: [9] },
  { id: 11, title: '남동 빛의 거리', region: 'GYEONGGI', addr: '인천 남동구 인주대로', lat: 37.4415949966, lon: 126.7360188509, start: -8, days: 40, rooms: [47, 31] },
  // ── 지방 ──
  { id: 12, title: '춘천 호수 재즈 페스티벌', region: 'GANGWON', addr: '강원 춘천시 의암호 일대', lat: 37.8855818, lon: 127.7298976, start: -1, days: 3, rooms: [58, 36] },
  { id: 13, title: '대전 사이언스 페스티벌', region: 'CHUNGCHEONG', addr: '대전 유성구 대덕대로', lat: 36.3504119, lon: 127.3845475, start: 9, days: 4, rooms: [14] },
  { id: 14, title: '경주 야간 문화제', region: 'GYEONGBUK', addr: '경북 경주시 첨성로', lat: 35.8346, lon: 129.2194, start: -2, days: 9, rooms: [66, 49, 25] },
  { id: 15, title: '부산 불꽃 축제', region: 'GYEONGNAM', addr: '부산 수영구 광안해변로', lat: 35.1531, lon: 129.1187, start: 20, days: 2, rooms: [17, 5] },
  { id: 16, title: '전주 한옥마을 소리제', region: 'JEOLLA', addr: '전북 전주시 완산구 은행로', lat: 35.8151, lon: 127.153, start: -1, days: 5, rooms: [44, 28] },
  { id: 17, title: '제주 유채꽃 페스타', region: 'JEJU', addr: '제주 서귀포시 표선면', lat: 33.4605, lon: 126.9399, start: -6, days: 25, rooms: [62, 35, 20] },
];

const ROOM_TITLES = [
  '같이 가요', '맛집 공유방', '포토스팟 공유', '주차·교통 정보', '혼자 왔어요',
  '후기 공유방', '굿즈 교환', '분실물 센터', '막차 시간 공유', '사진 잘 찍는 법',
];

export const FAKE_USERS = [
  { userId: 'u-2', nickname: '노란고양이' },
  { userId: 'u-3', nickname: '푸른여우' },
  { userId: 'u-4', nickname: '느긋한수달' },
  { userId: 'u-5', nickname: '반짝별' },
  { userId: 'u-6', nickname: '심야산책러' },
  { userId: 'u-7', nickname: '축제요정' },
];

const CHAT_LINES = [
  '지금 입구 쪽 사람 많아요?', '방금 도착했어요!', '공연 몇 시에 시작하나요?',
  '푸드트럭 줄 엄청 길어요 ㅠㅠ', '저기 포토존 예쁘네요', '날씨 진짜 좋다',
  '화장실 어디 있는지 아시는 분?', '주차장 꽉 찼어요', '굿즈 아직 남아있나요?',
  '혼자 오셨어요? 같이 구경해요', '저는 3시쯤까지 있을 예정이에요', '조명 켜지니까 분위기 대박',
  '막차 시간 확인하세요~', '아까 그 무대 너무 좋았어요', '다들 어디서 보고 계세요?',
  '지금 가면 앞자리 가능해요', '사진 찍어드릴까요?', '돗자리 펴기 좋은 자리 찾았어요',
  '따뜻하게 입고 오세요, 바람 차요', '내일도 오시나요?', 'ㅋㅋㅋㅋ 맞아요', '와 감사합니다!',
];

export const BOT_REPLIES = [
  '오 저도 그래요!', '맞아요 ㅋㅋ', '혹시 어디쯤이세요?', '좋은 정보 감사합니다 :)',
  '저도 방금 도착했어요', '같이 구경해요~', '사진 나중에 공유해주세요!', '오늘 사람 진짜 많네요',
];

/* ------------------------------------------------------------------ */
/* 상태                                                                */
/* ------------------------------------------------------------------ */

type FestivalRecord = Omit<FestivalAPI, 'chatRoomCount' | 'totalParticipantCount'>;
type RoomRecord = {
  chatRoomId: string;
  festivalId: number;
  userId: string;
  title: string;
  participantCount: number;
};
type MessageRecord = {
  id: string;
  seq: number;
  chatRoomId: string;
  userId: string;
  nickname: string;
  content: string;
  createdAt: Date;
  likedBy: Set<string>;
};

const today = new Date();

const festivals: FestivalRecord[] = FESTIVAL_SEEDS.map((s) => ({
  festivalId: s.id,
  title: s.title,
  addr1: s.addr,
  eventStartDate: ymd(addDays(today, s.start)),
  eventEndDate: ymd(addDays(today, s.start + s.days)),
  firstImage: poster(s.title, (s.id * 47) % 360),
  lat: s.lat,
  lon: s.lon,
  region: s.region,
}));

const rooms: RoomRecord[] = [];
const messages = new Map<string, MessageRecord[]>();
const seqCounter = new Map<string, number>();
const myRoomIds = new Set<string>();
let roomCounter = 0;

function pushMessage(
  roomId: string,
  m: { userId: string; nickname: string; content: string; createdAt?: Date; likedBy?: string[] }
) {
  const seq = (seqCounter.get(roomId) ?? 0) + 1;
  seqCounter.set(roomId, seq);
  const rec: MessageRecord = {
    id: `msg-${roomId}-${String(seq).padStart(5, '0')}`,
    seq,
    chatRoomId: roomId,
    userId: m.userId,
    nickname: m.nickname,
    content: m.content,
    createdAt: m.createdAt ?? new Date(),
    likedBy: new Set(m.likedBy ?? []),
  };
  if (!messages.has(roomId)) messages.set(roomId, []);
  messages.get(roomId)!.push(rec);
  return rec;
}

function seedMessages(roomId: string, count: number) {
  const rand = mulberry32(hash(roomId));
  // 현재 → 과거 방향으로 시간을 거슬러 올라가며 만든 뒤 뒤집는다
  let t = Date.now() - 2 * MIN;
  const batch: { userId: string; nickname: string; content: string; createdAt: Date; likedBy: string[] }[] = [];
  for (let i = 0; i < count; i++) {
    const user = FAKE_USERS[Math.floor(rand() * FAKE_USERS.length)];
    const gap = rand() < 0.08 ? (4 + rand() * 6) * 60 * MIN : (1 + rand() * 25) * MIN; // 가끔 몇 시간 공백 → 날짜 구분선 확인용
    batch.push({
      userId: user.userId,
      nickname: user.nickname,
      content: CHAT_LINES[Math.floor(rand() * CHAT_LINES.length)],
      createdAt: new Date(t),
      likedBy: rand() < 0.15 ? [user.userId === 'u-2' ? 'u-3' : 'u-2'] : [],
    });
    t -= gap;
  }
  batch.reverse().forEach((m) => pushMessage(roomId, m));
}

// 시드 채팅방 + 메시지 생성
FESTIVAL_SEEDS.forEach((s) => {
  s.rooms.forEach((count, i) => {
    const chatRoomId = `room-${s.id}-${i + 1}`;
    rooms.push({
      chatRoomId,
      festivalId: s.id,
      userId: FAKE_USERS[i % FAKE_USERS.length].userId,
      title: i === 0 && count >= MOCK_MAX_PARTICIPANTS ? '만석방 (정원 초과 테스트)' : ROOM_TITLES[i % ROOM_TITLES.length],
      participantCount: count,
    });
    seedMessages(chatRoomId, 45);
  });
});

// 내가 이미 참여 중인 방 2개 (내 채팅 탭 확인용)
['room-1-2', 'room-1-3'].forEach((id) => myRoomIds.add(id));

const currentUser: User = {
  userId: MOCK_USER_ID,
  profileNickName: MOCK_USER_NICKNAME,
  accountEmail: 'mock-user@zony.dev',
  createdAt: new Date(Date.now() - 30 * DAY).toISOString(),
};

/* ------------------------------------------------------------------ */
/* 조회/변경 함수                                                      */
/* ------------------------------------------------------------------ */

export const getUser = () => currentUser;

export const MAX_PARTICIPANTS = MOCK_MAX_PARTICIPANTS;

const lastMessageOf = (roomId: string) => {
  const list = messages.get(roomId);
  return list && list.length ? list[list.length - 1] : undefined;
};

export function roomView(r: RoomRecord): RoomAPI {
  const f = festivals.find((x) => x.festivalId === r.festivalId)!;
  const last = lastMessageOf(r.chatRoomId);
  return {
    chatRoomId: r.chatRoomId,
    festivalId: r.festivalId,
    userId: r.userId,
    title: r.title,
    lat: f.lat,
    lon: f.lon,
    festivalTitle: f.title,
    participantCount: r.participantCount,
    lastMessageAt: last ? toWallUtc(last.createdAt) : toWallUtc(new Date()),
    lastContent: last?.content ?? '',
  };
}

export function festivalView(f: FestivalRecord): FestivalAPI {
  const fr = rooms.filter((r) => r.festivalId === f.festivalId);
  return {
    ...f,
    chatRoomCount: fr.length,
    totalParticipantCount: fr.reduce((sum, r) => sum + r.participantCount, 0),
  };
}

/** 진행 중이거나 예정인(= 아직 안 끝난) 축제 */
export const getLiveFestivals = () => {
  const todayStr = ymd(new Date());
  return festivals.filter((f) => f.eventEndDate >= todayStr);
};

export const getFestivalById = (id: number) => festivals.find((f) => f.festivalId === id);

export const getRoomRecord = (roomId: string) => rooms.find((r) => r.chatRoomId === roomId);

export const getRoomsOfFestival = (festivalId: number) =>
  rooms.filter((r) => r.festivalId === festivalId);

export const getAllRooms = () => rooms;

export const getMyRooms = () =>
  rooms
    .filter((r) => myRoomIds.has(r.chatRoomId))
    .map(roomView)
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));

export const isJoined = (roomId: string) => myRoomIds.has(roomId);

export function joinRoom(roomId: string) {
  const r = getRoomRecord(roomId)!;
  myRoomIds.add(roomId);
  r.participantCount += 1;
}

export function leaveRoom(roomId: string) {
  const r = getRoomRecord(roomId);
  if (r && myRoomIds.has(roomId)) r.participantCount = Math.max(0, r.participantCount - 1);
  myRoomIds.delete(roomId);
}

export function createRoom(festivalId: number, title: string) {
  roomCounter += 1;
  const rec: RoomRecord = {
    chatRoomId: `room-new-${roomCounter}`,
    festivalId,
    userId: MOCK_USER_ID,
    title,
    participantCount: 1,
  };
  rooms.push(rec);
  myRoomIds.add(rec.chatRoomId);
  pushMessage(rec.chatRoomId, {
    userId: 'zony-bot',
    nickname: 'Zony',
    content: '채팅방이 만들어졌어요. 첫 메시지를 남겨보세요!',
  });
  return rec;
}

export function toChatAPI(m: MessageRecord): ChatAPI {
  return {
    id: m.id,
    chatRoomId: m.chatRoomId,
    userId: m.userId,
    nickname: m.nickname,
    content: m.content,
    type: 'TEXT',
    createdAt: toWallUtc(m.createdAt),
    likeCount: m.likedBy.size,
    liked: m.likedBy.has(MOCK_USER_ID),
  };
}

export function addMessage(roomId: string, m: { userId: string; nickname: string; content: string }) {
  return toChatAPI(pushMessage(roomId, m));
}

/** 최신순 페이지네이션. before = 이 id 보다 오래된 메시지부터 */
export function getMessagePage(roomId: string, before: string | null | undefined, size = 20) {
  const all = messages.get(roomId) ?? [];
  let pool = all;
  if (before) {
    const beforeSeq = all.find((m) => m.id === before)?.seq ?? Infinity;
    pool = all.filter((m) => m.seq < beforeSeq);
  }
  const sorted = [...pool].sort((a, b) => b.seq - a.seq);
  return {
    content: sorted.slice(0, size).map(toChatAPI),
    hasNext: sorted.length > size,
  };
}

export function toggleLike(messageId: string) {
  for (const [roomId, list] of messages) {
    const m = list.find((x) => x.id === messageId);
    if (!m) continue;
    if (m.likedBy.has(MOCK_USER_ID)) m.likedBy.delete(MOCK_USER_ID);
    else m.likedBy.add(MOCK_USER_ID);
    return { roomId, messageId, liked: m.likedBy.has(MOCK_USER_ID), likeCount: m.likedBy.size };
  }
  return null;
}
