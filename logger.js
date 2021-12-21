import winston from 'winston'
import pjson from './package.json'
import { PapertrailTransport } from 'winston-papertrail-transport'
// const myformat = winston.format.cli({ colors: { info: 'blue' } })
const errorStackTracerFormat = winston.format(info => {
  if (info.level === 'error') {
    info.message = `<<ERROR>> ${info.message}`
  }
  return info
})
const papertrailFormat = winston.format.combine(
  errorStackTracerFormat(),
  winston.format.colorize(),
  winston.format.align(),
  winston.format.printf(info => `${info.level}: ${info.message}`)
)
const consoleFormat = winston.format.combine(
  errorStackTracerFormat(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.colorize(),

  winston.format.printf(info => `[${info.timestamp}] ${info.level}: ${info.message}`)
)
const papertrailTransport = new PapertrailTransport({
  host: 'logs.papertrailapp.com',
  port: 41288,
  program: pjson.name,
  format: papertrailFormat,
  handleExceptions: true
})
const logger = winston.createLogger({
  transports: [new winston.transports.Console({ format: consoleFormat, handleExceptions: true, handleRejections: true })]
})

if (process.env.NODE_ENV === 'production') {
  logger.configure({
    level: 'info',
    transports: [papertrailTransport, new winston.transports.Console({ format: consoleFormat, handleExceptions: true, handleRejections: true })]
  })
}

if (process.env.NODE_ENV === 'development') {
  logger.configure({
    level: 'debug',
    transports: [papertrailTransport, new winston.transports.Console({ format: consoleFormat, handleExceptions: true, handleRejections: true })]
  })
}

if (process.env.NODE_ENV === 'local') {
  logger.configure({
    level: 'debug',
    transports: [new winston.transports.Console({ format: consoleFormat, handleExceptions: true, handleRejections: true })]
  })
}

logger.exitOnError = false

export default logger
