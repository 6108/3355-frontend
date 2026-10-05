import ChatSection from "@/components/chat/ChatSection";
import Input from "@/components/common/Input";
import Header from "@/components/layout/Header";
import { useLeaveRoom, useMessagesInfinite } from "@/hooks/useRoom";
import useAuthStore from "@/stores/useAuthStore";
import { useConfirmStore } from "@/stores/useConfirmStore";
import useLocationStore from "@/stores/useLocationStore";
import useRoomStore from "@/stores/useRoomStore";
import type { ChatAPI, RoomAPI } from "@/types/api";
import { Client } from "@stomp/stompjs";
import { USE_MOCK, MockStompClient } from "@/mocks";
import { useQueryClient } from "@tanstack/react-query";
import { jwtDecode } from "jwt-decode";
import { LngLat } from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

// 목업이면 가짜 STOMP 클라이언트, 아니면 진짜
const StompClient = USE_MOCK ? (MockStompClient as unknown as typeof Client) : Client;

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatAPI[]>([]);
  const [message, setMessage] = useState("");
  const stompClientRef = useRef<Client | null>(null);
  const { accessToken } = useAuthStore();
  const { roomId } = useParams();
  const [userId, setUserId] = useState();
  const [distance, setDistance] = useState<number>(3000);
  const navigate = useNavigate();
  const { openConfirm, closeConfirm } = useConfirmStore();
  const { isAllowed, lat, lon } = useLocationStore();
  const location = useLocation();
  const { roomInfo } = location.state as { roomInfo: RoomAPI };

  const { mutate, isPending } = useLeaveRoom();

  const { updateRoomActivity } = useRoomStore();
  const queryClient = useQueryClient();


  if (!roomInfo) {
    navigate("/my-chat", { replace: true });
    return;
  }

  if (!roomId) return;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessagesInfinite(roomId);


  useEffect(() => {
    if (!roomId) return;


    setMessages([]);
    const payload: any = jwtDecode(accessToken);
    console.log(payload?.sub || null);
    setUserId(payload?.sub)

    const client = new StompClient({
      brokerURL: "wss://ws.zony.kro.kr/chat",
      connectHeaders: {
        // Authorization: `Bearer ${tempToken}`,
        Authorization: `Bearer ${accessToken}`,
      },
      // debug: (str) => console.log("STOMP DEBUG:", str),

      onConnect: () => {
        console.log(" 연결됨");

        client.publish({
          destination: `/app/chat-rooms/${roomId}/join`,
          body: JSON.stringify({ lat, lon }),
          headers: { "content-type": "application/json" },
        });

        client.subscribe(`/sub/chat-rooms/${roomId}`, (frame) => {
          // console.log("서버 메시지 원본:", frame.body);
          const msg = JSON.parse(frame.body);
          // console.log("파싱된 메시지:", msg);

          if ('content' in msg) {
            // 일반 채팅 메시지
            setMessages(prev => [...prev, msg]);
          } else {
            // 좋아요 이벤트
            setMessages(prev =>
              prev.map(m =>
                m.id === msg.messageId
                  ? { ...m, liked: msg.liked, likeCount: msg.likeCount }
                  : m
              )
            );
          }
        });

        client.subscribe('/user/queue/errors', (frame) => {
          console.error('STOMP 에러 수신:', frame.body);
          // 여기에 에러 알림 로직 추가
        });

        console.log("이전대화불러오기")
        //이전대화
        fetchNextPage();
      },
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      if (client.active) {
        client.deactivate();
      }

      queryClient.resetQueries({ queryKey: ["messages", roomId] });

      const curTime = new Date;
      updateRoomActivity({ roomId, lastViewedAt: curTime, hasNewChat: false })
    };
  }, [roomId]);

  //무한 스크롤 감지
  const handleScrollUp = () => {
    // 스크롤이 최상단 근처에 도달하면 과거 메시지 로드
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };


  useEffect(() => {

    if (data) {
      // console.log("----", { data });
      const beforeMessage = data?.pages.flatMap(page => page.content).reverse();
      setMessages(prev => {
        const newMessages = beforeMessage.filter(m => !prev.some(p => p.id === m.id));
        // console.log("messages", { newMessages, prev });
        return [...newMessages, ...prev];
      });

    }
  }, [data]);


  //메세지 전송
  const sendMessage = () => {
    console.log("전송 시도:", {
      connected: stompClientRef.current?.connected,
      message: message.trim()
    });

    if (!stompClientRef.current || !message.trim()) {
      console.log("전송 불가");
      setMessage("");
      return;
    }

    const payload = { content: message };
    console.log("전송 payload:", payload);

    stompClientRef.current.publish({
      destination: `/app/chat-rooms/${roomId}/send`,
      body: JSON.stringify(payload),
    });

    setMessage("");
  };


  useEffect(() => {
    if (isAllowed && lat && lon && roomInfo) {
      const p1 = new LngLat(lon, lat);
      const p2 = new LngLat(roomInfo.lon, roomInfo.lat);

      const dist = p1.distanceTo(p2);
      setDistance(dist);
      console.log("채팅방 진입 시 거리", dist);
      console.log(roomInfo.festivalTitle, lon, lat, roomInfo.lon, roomInfo.lat);


      if (dist > 500) {
        openConfirm('읽기 모드로 전환됩니다',
          `해당 축제의 존 이외의 공간에서는
          읽기 모드로만 탐색하실 수 있어요.`,
          closeConfirm, undefined, '확인')
      }
    }
  }, [roomInfo.chatRoomId, isAllowed]);

  //퇴장
  const handleLeaveRoom = () => {
    if (!accessToken || !roomInfo.chatRoomId) return;
    mutate({
      roomId: roomInfo.chatRoomId,
      token: accessToken,
    });

    closeConfirm();

  }

  return (
    <>
      <Header showBack={true} info={roomInfo}
        onLeaveRoom={() => openConfirm('채팅방을 나가시겠어요?',
          "모든 채팅 기록이 사라집니다.",
          handleLeaveRoom, undefined, '나가기', '취소', 'error')} />
      <div className='flex-1 w-full h-full relative overflow-hidden'>
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto">
            <ChatSection userId={userId} messages={messages} onScrollUp={handleScrollUp} />
          </div>
          <div className="px-4 py-3 ">
            <Input
              type="text"
              placeholder="메세지 입력"
              value={message}
              onChange={(e: any) => setMessage(e.target.value)}
              // defaultStyle="px-4 py-2 min-h-[38px] border rounded-2 text-text-quaternary border-line-border-secondary bg-surface-container-default"
              // focusStyle="px-4 py-2 min-h-[38px] border rounded-2 text-text-primary border-state-interacion-border-focus bg-surface-container-default"
              // completeStyle="px-4 py-2 min-h-[38px] border rounded-2 text-text-primary border-state-interacion-border-focus bg-surface-container-default"
              // disabledStyle="px-4 py-2 min-h-[38px] rounded-2 text-text-disabled bg-state-interacion-container-disabled"
              defaultStyle="px-4 py-2 min-h-[38px] border rounded-2 text-text-quaternary border-line-border-secondary bg-surface-container-default"
              focusStyle="px-4 py-2 min-h-[38px] border rounded-2 text-text-primary border-state-interacion-border-focus bg-surface-container-default"
              completeStyle="px-4 py-2 min-h-[38px] border rounded-2 text-text-primary border-state-interacion-border-focus bg-surface-container-default"
              disabledStyle="px-4 py-2 min-h-[38px] rounded-2 text-text-disabled bg-state-interacion-container-disabled"
              isDisabled={distance > 500}
              onSend={() => sendMessage()}
              onClear={() => setMessage('')}
              inputType="textarea"
            />
          </div>
        </div>
      </div>
    </>
  );
}
