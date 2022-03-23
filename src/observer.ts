import { ObserverState } from 'jotto_core'
import User from './user'

export default class Observer extends User {

  public userState(): ObserverState {
    return {
      ...super.userState(),
      type: 'observer'
    }
  }

}