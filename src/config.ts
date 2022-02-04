import { injectable } from 'tsyringe'
import { Minutes, Seconds } from './types'

export interface Config {
  preGameLength: Seconds
  gameLength: Minutes | undefined
}

@injectable()
export class AppConfig implements Config {

  public readonly preGameLength: Seconds
  public readonly gameLength: Minutes | undefined

  constructor(config: Config) {
    this.preGameLength = config.preGameLength
    this.gameLength = config.gameLength
  }

}