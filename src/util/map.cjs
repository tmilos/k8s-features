
class Map {
  constructor(data = undefined) {
    this.items = {};
    if (data) {
      for (let chunk of data) {
        this.items[chunk[0]] = chunk[1];
      }
    }
  }

  values() {
    const data = [];
    for (let k in this.items) {
      data.push(this.items[k]);
    }
    return data;
  }

  has(key) {
    return key in this.items;
  }

  set(key, value) {
    this.items[key] = value;
  }

  get(key) {
    if (key in this.items) {
      return this.items[key];
    }
    return undefined;
  }

  size() {
    return Object.keys(this.items).length;
  }

  delete(key) {
    const data = {}
    for (let k in this.items) {
      if (k != key) {
        data[k] = this.items[k];
      }
    }
    this.items = data;
  }

  [Symbol.iterator]() {
    let index = -1;
    let data = Object.keys(this.items).map(k => [k, this.items[k]]);

    return {
      next: () => ({ value: data[++index], done: !(index in data) })
    };
  }
}

module.exports = {
  Map,
};
