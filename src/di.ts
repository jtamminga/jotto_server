import { container } from 'tsyringe'
import { AppConfig } from './config'


export function initializeInjections() {

  const config = new AppConfig({
    gameLength: 1
  })

  container.registerInstance(AppConfig, config)

}