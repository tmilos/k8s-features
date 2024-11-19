
const charactersUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const charactersLower = 'abcdefghijklmnopqrstuvwxyz';
const charactersDigit = '0123456789';
const charactersSpecial = '!@#$%^&*/';

/**
 *
 * @param {number|undefined} length
 * @param {boolean} upper
 * @param {boolean} lower
 * @param {boolean} digit
 * @param {boolean} special
 * @returns {string}
 */
function makeid(length = undefined, upper = false, lower = true, digit = true, special = false) {
  if (!length || length < 1 || length > 100) {
    length = 4;
  }
  let result = '';
  const characters = (upper ? charactersUpper : '')+(lower ? charactersLower : '')+(digit ? charactersDigit : '')+(special ? charactersSpecial : '');
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

module.exports = {
  makeid,
};
