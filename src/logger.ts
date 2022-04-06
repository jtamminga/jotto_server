import 'colors'

type LoggingDomain =
  | 'middleware'

export class Logger {

  constructor(private domain: LoggingDomain) { }

  info(message: string) {
    console.log(
      `[${this.domain}]`.gray.bold,
      message.gray
    )
  }

  error(message: string) {
    console.error(
      `[${this.domain}]`.red.bold,
      message.red
    )
  }
}