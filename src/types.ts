import { Socket } from "socket.io";

export interface Session {
  userId: string;
  username: string;
  connected: boolean;
}

export interface SessionStore {
  findSession(id: string): Session;
  saveSession(id: string, session: Session): void;
  allSessions(): Session[];
}

export interface JottoSocket extends Socket {
  sessionId: string;
  userId: string;
  username: string;
}

export interface UserState extends Session {
  won: boolean;
  ready: boolean;
}

export enum GameState {
  PICKING_WORD,
  STARTED,
  GAME_OVER
}