import { injectable } from 'tsyringe'
import { Seconds } from './types'

export interface Config {
  preGameLength: Seconds
}

@injectable()
export class AppConfig implements Config {

  public readonly preGameLength: Seconds

  constructor(config: Config) {
    this.preGameLength = config.preGameLength
  }

}