import { Subject } from 'rxjs'
import { Event } from './events'
import { singleton } from 'tsyringe'

@singleton()
export class EventBus {

  private bus: Subject<Event>

  constructor() {
    this.bus = new Subject<Event>()
  }

  public get events$() {
    return this.bus.asObservable()
  }

  public publish(event: Event) {
    this.bus.next(event)
  }

}