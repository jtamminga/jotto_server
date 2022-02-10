import { Session } from 'jotto_core'
import User from './user'

export default class Observer extends User {

  constructor(session: Session) {
    super(session)
  }

  public userState(): Session {
    return this.asSession()
  }

}