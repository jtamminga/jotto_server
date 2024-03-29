import { interval } from 'rxjs'
import { singleton } from 'tsyringe'
import { EventBus } from '../eventBus'
import { TimeEvents } from '../events'

@singleton()
export class TimerService {

  constructor(
    private _bus: EventBus
  ) { }

  public start() {
    interval(1000 * 60 * 30) // every 30 minutes
      .subscribe(() => {
        this._bus.publish(TimeEvents.create('tick'))
      })
  }
}