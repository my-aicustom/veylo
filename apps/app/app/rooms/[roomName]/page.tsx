import { RoomPageClient } from './room-page-client';

export default async function RoomPage({ params }: { params: Promise<{ roomName: string }> }) {
  const { roomName } = await params;
  return <RoomPageClient roomName={roomName} />;
}
