import { injectable } from 'tsyringe'
import { Minutes } from './types'

export interface Config {
  gameLength: Minutes
}

@injectable()
export class AppConfig implements Config {

  public readonly gameLength: Minutes

  constructor(config: Config) {
    this.gameLength = config.gameLength
  }

}