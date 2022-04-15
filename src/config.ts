import { injectable } from 'tsyringe'
import { Seconds } from './types'

export interface Config {
  pickWordLength: Seconds
  preGameLength: Seconds
}

@injectable()
export class AppConfig implements Config {

  public readonly pickWordLength: Seconds
  public readonly preGameLength: Seconds

  constructor(config: Config) {
    this.pickWordLength = config.pickWordLength
    this.preGameLength = config.preGameLength
  }

}