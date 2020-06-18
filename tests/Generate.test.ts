import { buildSchema } from 'graphql';
import path from 'path';

import { GQL2Yup } from '../src/GQL2Yup';


describe('new GQL2Yup()', () => {
  const srcFile = path.resolve(__dirname, './simple.gql');
  const srcString = `type Person { name: String! }`;
  const srcSchema = buildSchema(srcString);

  it('should generate a yup object from a gql schema object', async () => {
    const gql2yup = new GQL2Yup(srcSchema);
    const Person = gql2yup.getEntity('Person');
    const name = 'name';
    const v = await Person.validate({ name })
    expect(v.name).toEqual(name);
  });

  it('should generate a yup object from a string as src', async () => {
    const gql2yup = new GQL2Yup(srcString);
    const Person = gql2yup.getEntity('Person');
    const name = 'name';
    const v = await Person.validate({ name })
    expect(v.name).toEqual(name);
  });

  it('should generate a yup object from a string as file src', async () => {
    const gql2yup = new GQL2Yup(srcFile);
    const Person = gql2yup.getEntity('Person');
    const name = 'name';
    const v = await Person.validate({ name })
    expect(v.name).toEqual(name);
  });
});


describe('type normalization', () => {
  it('should parse Float as number', async () => {
    const gql2yup = new GQL2Yup('type Test { test: Float }');
    const Test = gql2yup.getEntity('Test');
    const test = 1.4;
    const v = await Test.validate({ test })
    expect(v.test).toEqual(test);
  });

  // it('should parse DateTime as Date', async () => {
  //   const gql2yup = new GQL2Yup('type Test { test: DateTime }');
  //   const Person = gql2yup.getEntity('Test');
  //   const test = new Date();
  //   const v = await Person.validate({test})
  //   expect(v.test).toEqual(test);
  // });

  it('should parse String as string', async () => {
    const gql2yup = new GQL2Yup('type Test { test: String }');
    const Test = gql2yup.getEntity('Test');
    const test = 'test';
    const v = await Test.validate({ test })
    expect(v.test).toEqual(test);
  });

  it('should parse Int as number', async () => {
    const gql2yup = new GQL2Yup('type Test { test: Int }');
    const Test = gql2yup.getEntity('Test');
    const test = 1;
    const v = await Test.validate({ test })
    expect(v.test).toEqual(test);
  });

  it('should parse Boolean as boolean', async () => {
    const gql2yup = new GQL2Yup('type Test { test: Boolean }');
    const Test = gql2yup.getEntity('Test');
    const test = false;
    const v = await Test.validate({ test })
    expect(v.test).toEqual(test);
  });

  it('should parse arrays', async () => {
    const gql2yup = new GQL2Yup('type Test { test: [Boolean!]! }');
    const Test = gql2yup.getEntity('Test');
    const test = [false, true];
    const v = await Test.validate({ test })
    expect(v.test).toEqual(test);
  });

  it('should parse array of custom type as lazy array', async () => {
    const gql2yup = new GQL2Yup(`
      type Custom { foo: String! }
      type Test { test: [Custom!]! }
    `);
    const Test = gql2yup.getEntity('Test');
    const test = [{ foo: 'bar' }, { foo: 'foo' }]
    const v = await Test.validate({ test });
    expect(v.test).toEqual(test);
  });

  it('should parse union as mixed().onOf(...)', async () => {
    const gql2yup = new GQL2Yup(`
      type Custom1 { type: String! foo: String! }
      type Custom2 { type: String! bar: String! }
      union Custom = Custom1 | Custom2
    `);
    const Custom = gql2yup.getEntity('Custom');

    const test1 = { type: '1', foo: 'bar' };
    const v1 = await Custom.validate(test1);
    expect(v1.foo).toEqual(test1.foo);

    const test2 = { type: '2', bar: 'foo' };
    const v2 = await Custom.validate(test2);
    expect(v2.bar).toEqual(test2.bar);
  });
});
