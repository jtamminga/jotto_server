import { Socket } from "socket.io";
import Player from "./player";

export interface JottoSocket extends Socket {
  sessionId: string;
  userId: string;
  username: string;
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

export interface GuessSubmission {
  id: string
  word: string
}

export interface Guess {
  id: string
  word: string;
  common: number;
}

export interface UserState extends Session {
  won: boolean;
  ready: boolean;
}

export interface GuessResult {
  common: number;
  won: boolean;
}

export interface GameGuessResult extends GuessResult {
  player: Player;
  gameOver: boolean;
  place: number | undefined;
}

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

export interface History {
  from: string;
  to: string;
  word: string;
  common: number;
}

export interface GameStateRestore {
  state: GameState,
  users: UserState[];
  playerOrder: string[];
  word?: string;
  currentTurn?: string;
  // guesses: Guess[];
  history: History[];
}

export enum GameState {
  pickUsername, // make sure indexes match
  pickWords,
  started,
  gameOver
}

export class IllegalStateError extends Error { }