//const { describe, it, assert } = require('jest');
const { Map } = require('./map.cjs');

describe('map', () => {

  it('works', () => {
    const m = new Map([['a', 'aaa'], ['b', 'bbb']]);
    expect(m.has('a')).toBe(true);
    expect(m.has('b')).toBe(true);
    expect(m.has('c')).toBe(false);

    expect(m.get('a')).toBe('aaa');
    expect(m.get('b')).toBe('bbb');
    expect(m.get('c')).toBe(undefined);

    m.set('c', 'ccc');
    expect(m.has('c')).toBe(true);
    expect(m.get('c')).toBe('ccc');

    let data = {};
    for (let [k, v] of m) {
      data[k] = v;
    }
    expect(data).toEqual({a: 'aaa', b: 'bbb', c: 'ccc'});

    expect(m.size()).toBe(3);

    m.delete('a');

    expect(m.has('a')).toBe(false);
    expect(m.get('a')).toBe(undefined);

    data = {};
    for (let [k, v] of m) {
      data[k] = v;
    }
    expect(data).toEqual({b: 'bbb', c: 'ccc'});

    expect(m.values()).toEqual(['bbb', 'ccc']);
  });

});
