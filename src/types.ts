export type User = { id: string; name: string; avatar: string; online?: boolean };
export type Room = { id: string; name: string; kind: 'world' | 'guild' | 'private'; description: string; ownerId: string | null; joined: boolean; members: User[]; unread: number };
export type ChatMessage = { id: string; seq: number; roomId: string; userId: string; name: string; avatar: string; text: string; createdAt: number };
export type Snapshot = { users: User[]; rooms: Room[]; aiEnabled: boolean };
export type Page = { messages: ChatMessage[]; hasMore: boolean };
