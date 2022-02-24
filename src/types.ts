import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents, SocketData, Session } from 'jotto_core'
import { DefaultEventsMap } from 'socket.io/dist/typed-events'

export type JottoSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>

export type Seconds = number
export type Minutes = number

export interface SessionStore {
  findSession(id: string): Session | undefined;
  saveSession(id: string, session: Session): void;
  allSessions(): Session[];
  hasSession(id: string): boolean;
}

export interface GuessSubmission {
  id: string
  word: string
}

export interface Guess {
  id: string
  word: string;
  date: number;
  common: number;
  won: boolean;
}

export type PlayerLobbyState =
  | 'in_room'
  | 'picking_word'
  | 'picked_word'
  | 'playing'
  | 'game_over'

export interface GameConfig {
  opponents: { id: string, opponentId: string }[]
}

export interface PlayerSummary {
  userId: string;
  place: number;
  word: string;
  numGuesses: number;
}

export interface GameSummary {
  playerSummaries: PlayerSummary[]
}

export interface History extends Guess {
  from: string;
  to: string;
}

export interface UserRestore {
  userId: string
  state: PlayerLobbyState
  users: Session[]
  word?: string
  config?: GameConfig
  gameSummary?: GameSummary,
  history?: History[]
}

export enum GameState {
  pickingWords,
  playing,
  gameOver,
  destroyed
}

export class IllegalStateError extends Error { }

export interface Disposable {
  dispose(): void
}