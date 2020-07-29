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

  it('should generate a yup object from a string as file src', async () => {
    const gql2yup = new GQL2Yup(`enum Test {
      value1,
      value2
    }`);
    const Test = gql2yup.getEntity('Test');
    expect(await Test.validate('value1')).toEqual('value1');
    expect(await Test.validate('value2')).toEqual('value2');
    try {
      await Test.validate('wrong');
    } catch (e) {
      expect(e.message).toEqual(`Enum Test must be one of the following values: value1, value2`)
    }
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

  it('should parse DateTime as Date', async () => {
    expect.assertions(5);
    const gql2yup = new GQL2Yup(`
      scalar DateTime
      type Test { test: DateTime }
    `);
    const Test = gql2yup.getEntity('Test');

    const test = new Date();
    const v1 = await Test.validate({ test });
    expect(v1.test).toEqual(test);

    // Allow null
    const v2 = await Test.validate({ test: null });
    expect(v2.test).toEqual(null);

    try {
      await Test.validate({ test: 123 });
    } catch (e) {
      expect(e.message).toEqual('Invalid date format');
    }

    try {
      await Test.validate({ test: 'some date' });
    } catch (e) {
      expect(e.message).toEqual('Invalid date format');
    }

    // Required
    try {
      const Test = new GQL2Yup(`
        scalar DateTime
        type Test { test: DateTime! }
      `).getEntity('Test');
      await Test.validate({ test: null });
    } catch (e) {
      expect(e.message).toEqual('test is a required field');
    }

  });

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

  it('should allow nullable fields if not required with \'!\'', async () => {
    const gql2yup = new GQL2Yup(`
      type Test { nullable: String }
    `);

    // Pass null
    const nulled = { nullable: null };
    expect(
      await gql2yup.getEntity('Test').validate(nulled)
    ).toEqual(nulled);

    // Pass undefined
    const undef = { nullable: undefined }
    expect(
      await gql2yup.getEntity('Test').validate(undef)
    ).toEqual(undef);
  })
});


describe('Exclude fields', () => {
  it('should ignore field on ObjectType', async () => {
    const gql = new GQL2Yup(`
        type Foo { exclude: String! require1: String! }
      `, ['exclude']);

    const Foo = gql.getEntity('Foo');

    const input = { require1: 'lorem ipsum' };
    expect(
      await Foo.validate(input)
    ).toEqual(input);
  });

  it('should ignore field on ObjectType across many types', async () => {
    const gql = new GQL2Yup(`
        type Foo { exclude: String! require1: String! }
        type Bar { exclude: String! require2: String! }
      `, ['exclude']);

    const Foo = gql.getEntity('Foo');
    const Bar = gql.getEntity('Bar');

    const input1 = { require1: 'lorem ipsum' };
    expect(
      await Foo.validate(input1)
    ).toEqual(input1);

    const input2 = { require2: 'lorem ipsum' };
    expect(
      await Bar.validate(input2)
    ).toEqual(input2);
  });

  it('should ignore "ObjectType.field" format', async () => {
    const gql = new GQL2Yup(`
        type Foo { exclude: String! require1: String! }
        type Bar { exclude: String! require2: String! }
      `, ['Foo.exclude']);

    const Foo = gql.getEntity('Foo');
    const Bar = gql.getEntity('Bar');

    const input1 = { require1: 'lorem ipsum' };
    expect(
      await Foo.validate(input1)
    ).toEqual(input1);

    const input2 = { exclude: 'required', require2: 'lorem ipsum' };
    expect(
      await Bar.validate(input2)
    ).toEqual(input2);
  });
})
