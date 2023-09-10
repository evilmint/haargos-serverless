import { brotliCompressSync, gzipSync, deflateSync } from 'zlib';

function compressForAWSLambda(request, response, next) {
  let oldSend = response.send;
  response.send = function (sdata) {
    const acceptEncodingHeader = request.header('Accept-Encoding');

    const encodings = new Set();
    if (acceptEncodingHeader) {
      acceptEncodingHeader.split(',').forEach(encoding => {
        encodings.add(encoding.toLowerCase().trim());
      });
    }
    var data = sdata;

    if (data) {
      if (encodings.has('br')) {
        response.set('content-encoding', 'br');
        response.isBase64Encoded = true;
        data = brotliCompressSync(data);
      } else if (encodings.has('gzip')) {
        response.set('content-encoding', 'gzip');
        response.isBase64Encoded = true;
        data = gzipSync(data);
      } else if (encodings.has('deflate')) {
        response.set('content-encoding', 'deflate');
        response.isBase64Encoded = true;
        data = deflateSync(data);
      }
    }

    response.send = oldSend;
    return response.send(data);
  };
  next();
}

export { compressForAWSLambda };
