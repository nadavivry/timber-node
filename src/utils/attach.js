import { Writable } from 'stream'
import Augment from '../utils/augment'
import errors from '../data/errors'
import debug from './debug'

/**
 * Attaches a transport stream to a writeable stream.
 *
 * @param {Array} transports - array of transports to attach to the stream
 * @param {Writable} toStream - the stream your transport will attach to
 * @param {Object} options - configuration options
 * @param {boolean} options.applyBackPressure
 */
const attach = (transports, toStream, { applyBackPressure = false } = {}) => {
  // Ensure all the streams are Writable
  for (let i = 0; i < transports.length; i++) {
    if (!(transports[i] instanceof Writable)) {
      throw new Error(errors.attach.notWritable)
    }
  }

  // Store refs to standard logging utilities
  const originalWrite = toStream.write

  debug(`attaching ${transports.length} transports to stream`)

  toStream.write = (message, encoding, fd) => {
    const log = message instanceof Augment ? message : new Augment(message)

    for (let i = 0; i < transports.length; i++) {
      const transport = transports[i]

      // It's possible to pass the source stream as a transport,
      // (i.e. if you want to have stdout logs output to stdout while using a transport)
      // for this reason we need to check if the transport is identical
      // to the source stream before writing to it, otherwise we'll cause a stack overflow.
      const written = transport === toStream
        ? // this condition preserves the ability to write to the original stream
          originalWrite.apply(transport, [log.data.message])
        : // and this writes to a separate transport stream
          transport.write(
            transport.acceptsObject ? log.data : log.data.message,
            encoding,
            fd
          )

      if (!written && applyBackPressure) {
        transport.once('drain', () => transport.write(...arguments))
      }
    }
  }

  return {
    detach: () => {
      toStream.write = originalWrite
    },
  }
}

export default attach
