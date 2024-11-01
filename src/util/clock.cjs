
class Clock {
  /**
   * @returns {number} milliseconds timestamp
   */
  getTime() {
    return new Date().getTime();
  }
}

module.exports = {
  Clock,
};
