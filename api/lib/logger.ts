type LogLevel = 'info' | 'error' | 'warn'

function base(level: LogLevel, msg: string, extra?: Record<string, any>) {
  const entry = {
    ts: Date.now(),
    level,
    msg,
    ...extra,
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry))
}

export function info(msg: string, extra?: Record<string, any>) {
  base('info', msg, extra)
}

export function error(msg: string, extra?: Record<string, any>) {
  base('error', msg, extra)
}

export function warn(msg: string, extra?: Record<string, any>) {
  base('warn', msg, extra)
}

export default { info, error, warn }
