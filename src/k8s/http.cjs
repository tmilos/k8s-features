const { get, RequestOptions } = require('node:https');
const { IncomingMessage } = require('node:http');

/**
 * @typedef {GetAsyncResult}
 * @property {IncomingMessage} response
 * @property {*} body
 */

/**
 * 
 * @param {string | URL} url 
 * @param {RequestOptions} options 
 * @returns {Promise<GetAsyncResult>}
 */
function getAsync(url, options) {
  return new Promise((resolve, reject) => {
    get(url, options, 
      /**
       * @param {IncomingMessage} res 
       */
      (res) => {  
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          const {statusCode} = res;
          const contentType = res.headers['content-type'];
          let error;
          if (statusCode !== 200) {
            error = new Error(`Request failed, status code ${statusCode}: ${rawData}`)
          } else if (!/^application\/json/.test(contentType)) {
            error = new Error(`Invalid content-type, expected application/json but received ${contentType}: ${rawData}`);
          }
          if (error) {
            reject(error);
            return;
          }

          try {
            const parsedData = JSON.parse(rawData);
            resolve({
              response: res,
              body: parsedData,
            });
          } catch (e) {
            reject(e);
          }
        });
      },
    );
  
  });
}

module.exports = {
  getAsync,
};
