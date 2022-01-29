import { injectable } from 'tsyringe'
import { Minutes } from './types'

export interface Config {
  gameLength: Minutes | undefined
}

@injectable()
export class AppConfig implements Config {

  public readonly gameLength: Minutes | undefined

  constructor(config: Config) {
    this.gameLength = config.gameLength
  }

}