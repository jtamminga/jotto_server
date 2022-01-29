import { container } from 'tsyringe'
import { AppConfig } from './config'


export function initializeInjections() {

  const config = new AppConfig({
    gameLength: undefined
  })

  container.registerInstance(AppConfig, config)

}