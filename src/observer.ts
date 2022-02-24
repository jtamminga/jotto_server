import { ObserverState, Session } from 'jotto_core'
import User from './user'

export default class Observer extends User {

  constructor(session: Session) {
    super(session)
  }

  public userState(): ObserverState {
    return this.asSession() as ObserverState
  }

}