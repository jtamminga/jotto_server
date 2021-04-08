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
  state: GameState,
  users: UserState[];
  playerOrder: string[];
  word: string | undefined;
  currentTurn: string | undefined;
  guesses: Guess[];
}

export enum GameState {
  PICK_USERNAME, // make sure indexes match
  PICKING_WORD,
  STARTED,
  GAME_OVER
}