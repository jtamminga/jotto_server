import { container } from 'tsyringe'
import { AppConfig } from './config'


export function initializeInjections() {

  const config = new AppConfig({
    pickWordLength: 20, // seconds
    preGameLength: 10 // seconds
  })

  container.registerInstance(AppConfig, config)

}