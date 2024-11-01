const { Clock } = require('./clock.cjs');

/**
 * @implements {Map}
 */
class ExpiringMap {

  constructor(expirationTime, data = undefined, clock = undefined) {
    this._expirationTime = expirationTime;
    this._clock = clock ?? new Clock();
    this._dataMap = new Map(data);
    this._timeMap = new Map();
    if (data) {
      for (let item of data) {
        this._timeMap.set(item[0], this._clock.getTime());
      }
    }
  }

  /**
   * @param {string} key 
   * @returns {number}
   */
  _insertTime(key) {
    return this._timeMap.get(key);
  }

  /**
   * @param {string} key 
   * @returns {boolean}
   */
  _isExpired(key) {
    if (!this._dataMap.has(key)) {
      return false;
    }
    const nowTime = this._clock.getTime();
    const insertTime = this._insertTime(key);
    const elapsed = insertTime - nowTime;
    return elapsed > this._expirationTime;
  }

  _clenup() {
    for (let key of this._dataMap.keys()) {
      if (this._isExpired(key)) {
        this.delete(key);
      }
    }
  }

  /**
   * @param {Clock} clock 
   */
  setClock(clock) {
    this._clock = clock;
  }

  /**
   * @returns {any[]}
   */
  values() {
    this._clenup();
    return this._dataMap.values();
  }

  /**
   * @returns {string[]}
   */
  keys() {
    this._clenup();
    return this._dataMap.keys();
  }

  /**
   * @param {string} key 
   * @returns {boolean}
   */
  has(key) {
    this._clenup();
    return this._dataMap.has(key);
  }

  /**
   * @param {string} key 
   * @param {any} value 
   */
  set(key, value) {
    this._dataMap.set(key, value);
    this._timeMap.set(key, this._clock.getTime());
  }

  /**
   * @param {string} key 
   * @returns {any}
   */
  get(key) {
    this._clenup();
    return this._dataMap.get(key);
  }

  /**
   * @returns {number}
   */
  size() {
    this._clenup();
    return this._dataMap.size();
  }

  /**
   * @param {string} key 
   */
  delete(key) {
    this._dataMap.delete(key);
    this._timeMap.delete(key);
  }

  [Symbol.iterator]() {
    this._clenup();
    return this._dataMap[Symbol.iterator];
  }

}

module.exports = {
  ExpiringMap,
};
