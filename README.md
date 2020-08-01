# GraphQL to Yup
[![Coverage Status](https://coveralls.io/repos/github/tristanMatthias/gql-to-yup/badge.svg?branch=master)](https://coveralls.io/github/tristanMatthias/gql-to-yup?branch=master)
![Build & Test](https://github.com/tristanMatthias/gql-to-yup/workflows/Build%20&%20Test/badge.svg)

## 🤔 Why?
Have you ever had a schema (gql) that you wanted to validate? Maybe it was for tests, or data ingestion, etc.
This small library takes in a GQL Schema, extracts all the objects, unions, enums, etc, and exposes them as [Yup valiation objects.](https://github.com/jquense/yup). It also supports Dates and nested schemas.

## 📦 Install
Both browser and Node.js compadible. Install with:

```bash
yarn add gql-to-yup
```

OR

```bash
npm i --save-dev gql-to-yup
```

## 🏃🏻‍♀️ How?

Take a path to a GQL file, a GQL string, or `GraphQLSchema` object, and pass it in:

```ts
import { GQL2Yup } from 'gql-to-yup';

// ...

const fromString = new GQL2Yup(`
  type Person {
    name: String!
    age: Int!
    address: String   # Not required
  }
`);

const Person = fromString.getEntity('Person') // returns Yup.object()
await Person.validate({
  name: 'Bruce Lee',
  age: 'twenty-seven' // Fails as this is not a number!
});
// Throws ValidationError: 'age must be a `number` type, but the final value was: `NaN` (cast from the value `"twenty-seven"`).'
```

And that's it!


## ⚡️ API:
### Basic usage

```ts
const pathToFile = './schema.gql';
const schema = new GQL2Yup(pathToFile);

const user = {
  firstName: 'Bruce',
  lastName: 'Lee',
  age: new Date(),
  deceased: true
}
await schema.getEntity('User').validate(user); // Returns user if valid
```

### Enum
```ts
const gender = new GQL2Yup(`enum Gender {
  male, female
}`).getEntity('Gender');

await gender.validate('female') // Valid
await gender.validate('foobar') // Throws error
```


### Numbers
`Float` and `Int` are both cast as `yup.number()`

```ts
const Foo = new GQL2Yup(`type Foo {
  float: Float!
  int: Int!
}`).getEntity('Foo');

await foo.validate({float: 1.1, int: 1) // Valid
```

### Dates
This library uses [MomentJS](https://momentjs.com/) for date validation. It supports the following formats:

- `moment.ISO_8601`
- `moment.RFC_2822`
- `moment.defaultFormat`
- `moment.defaultFormatUt`

```ts
const Article = new GQL2Yup(`type Article {
  published: Date! # Many frameworks add this type
}`).getEntity('Article');

await Article.validate({published: new Date()) // Valid
await Article.validate({published: '08/01/2020') // Valid as string
await Article.validate({published: 'Not a date') // Throws error
```

### Arrays
```ts
const Favourite = new GQL2Yup(`type Favourite {
  fruits: [String!]!
}`).getEntity('Favourite');

await Favourite.validate({fruits: ['apple', 'mango']) // Valid
await Favourite.validate({fruits: ['apple', false]) // Throws error
```

This will also work with custom objects

```ts
const Company = new GQL2Yup(`
  type Person {
    name: String!
    age: Int!
  }
  type Company {
    name: String!
    employees: [Person!]!
  }
`).getEntity('Company');

await Company.validate({
  name: 'Apple',
  employees: [
    {name: 'Tim Cook', age: 60},
    {name: 'Steve Jobs', age: 56},
  ]
}); // Valid
```

### Unions
In GQL you can combine types. This is also available in this library

```ts
const Offer = new GQL2Yup(`
  enum Color { red, blue, green }
  type Product {
    name: String!
    price: Int!
    color: Color
  }
  type Service {
    name: String!
    price: Int!
    duration: Int!
  }
  type Offer = Product | Service
`).getEntity('Offer');

await Offer.validate({
  name: 'iPhone',
  price: 999,
  color: 'red'
}); // Valid (as a "Product")

await Offer.validate({
  name: 'Apple Care',
  price: 200,
  duration: 365
}); // Valid (as a "Service")
```

## Exclude fields
Sometimes, it is useful to exlude certain properties from the generated validation schema.
This might be used if, for example, your data requires a list of objects, but is sent instead,
as a list of IDs. There are many cases for this.

The exlcude is passed as the **second argument** to `new GQL2Yup()` as an array of strings.
It uses dot notation. This means you can ignore an entire entity, or an entity's propertery.

```ts
const Exclude = new GQL2Yup(
  `
    type Product {
      name: String!
      price: Int!
    }
    type Bundle {
      name: String!
      products: [Product!]!
    }
  `,
  ['Bundle.products'] // Here we ignore the 'products' property on the 'Bundle' entity
).getEntity('Bundle');

await Exclude.validate({
  name: 'Apple',
  products: ['id1', 'id2', 'id3'] // Usually this would fail
}); // Valid
```

Excluded properties can also be excluded across all types.

```ts
new GQL2Yup(
  './schema.gql'
  ['price'] // Ignore ALL price properties on ALL entities
):
```
