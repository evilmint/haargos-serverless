import { NextFunction, Request, Response } from 'express';
import { brotliCompressSync, gzipSync, deflateSync } from 'zlib';

interface Base64Response extends Response {
  isBase64Encoded: boolean;
}

function compressForAWSLambda(request: Request, response: Base64Response, next: NextFunction) {
  let oldSend = response.send;
  response.send = function (data) {
    const acceptEncodingHeader = request.header('Accept-Encoding');

    const encodings = new Set();
    if (acceptEncodingHeader) {
      acceptEncodingHeader.split(',').forEach(encoding => {
        encodings.add(encoding.toLowerCase().trim());
      });
    }
    var alteredData = data;

    if (alteredData) {
      if (encodings.has('br')) {
        response.set('content-encoding', 'br');
        response.isBase64Encoded = true;
        alteredData = brotliCompressSync(alteredData);
      } else if (encodings.has('gzip')) {
        response.set('content-encoding', 'gzip');
        response.isBase64Encoded = true;
        alteredData = gzipSync(alteredData);
      } else if (encodings.has('deflate')) {
        response.set('content-encoding', 'deflate');
        response.isBase64Encoded = true;
        alteredData = deflateSync(alteredData);
      }
    }

    response.send = oldSend;
    return response.send(alteredData);
  };
  next();
}

export { compressForAWSLambda };
