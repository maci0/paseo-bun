/*
MIT License

Copyright (c) 2026 DeepSeek
Copyright (c) 2026 DeepSeek Harness (Bun Edition) Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// Reused from maci0/dsh-bun scripts/node-pty-bun-readstream.cjs.
const fs = require("node:fs");

// Bun's tty stream closes the PTY on EAGAIN; retry reads without closing the master.
exports.createReadStream = (fd) => {
  let stream;
  stream = fs.createReadStream(null, {
    fd,
    autoClose: true,
    fs: {
      close: fs.close,
      read(fd, buffer, offset, length, position, callback) {
        const read = () => {
          if (stream.destroyed) return callback(null, 0, buffer);
          fs.read(fd, buffer, offset, length, position, (error, bytesRead, data) => {
            if (error?.code === "EAGAIN") return setTimeout(read, 10);
            callback(error, bytesRead, data);
          });
        };
        read();
      },
    },
  });
  return stream;
};
