import { Socket } from "socket.io";

export interface Guess {
  guess: string;
  common: number;
}

export interface Session {
  userId: string;
  username: string;
  connected: boolean;
}

export interface SessionStore {
  findSession(id: string): Session | undefined;
  saveSession(id: string, session: Session): void;
  allSessions(): Session[];
  hasSession(id: string): boolean;
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

export interface GameStateRestore {
  users: UserState[];
  playerOrder: string[];
  word: string;
  currentTurn: string | undefined;
  guesses: Guess[];
}

export enum GameState {
  PICKING_WORD,
  STARTED,
  GAME_OVER
}