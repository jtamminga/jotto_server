import { container } from 'tsyringe'
import { AppConfig } from './config'


export function initializeInjections() {

  const config = new AppConfig({
    preGameLength: 10 // seconds
  })

  container.registerInstance(AppConfig, config)

}