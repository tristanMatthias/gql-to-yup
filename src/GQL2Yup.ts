import fs from 'fs';
import moment from 'moment';

import { buildSchema, GraphQLObjectType, GraphQLSchema, GraphQLUnionType, GraphQLEnumType } from 'graphql';
import * as yup from 'yup';

import { ArgType, Field, YupType } from './types';


/**
 * Default GQL types to filter out (so we can get custom types)
 */
export const DEFAULT_TYPES = [
  'Query',
  'Mutation',
  'String',
  'Int',
  'Float',
  'DateTime',
  'Boolean'
];


export class GQL2Yup {

  private _dateFormats = [
    moment.ISO_8601,
    moment.RFC_2822,
    moment.defaultFormat,
    moment.defaultFormatUtc
  ]

  private _entities: { [name: string]: yup.ObjectSchema<any> | yup.MixedSchema<any> } = {}


  constructor(
    schemaOrString: string | GraphQLSchema,
    public excludeFields: string[] = []
  ) {
    const { objects, unions, enums } = this._parse(schemaOrString);


    // Loop over all custom object types, and convert them to yup.object()'s
    objects.forEach(ot => {
      const fields = Object.values(ot.getFields())
        .reduce<yup.ObjectSchemaDefinition<any>>((_fields, f) => {

          // Skip field if it's exlcuded
          if (
            excludeFields.includes(`${ot.name}.${f.name}`) ||
            excludeFields.includes(f.name)
          ) return _fields;

          const [name, y] = this._fieldToYup(f)
          _fields[name] = y;
          return _fields;

        }, {});

      this._entities[ot.name] = yup.object().shape(fields);
    });


    unions.forEach(t => {
      const typeNames = t.getTypes().map(t => t.name).join(', ');
      const types = t.getTypes().map(t => this.getEntity(t.name));

      this._entities[t.name] = yup.mixed()
        .test({
          name: 'oneof',
          message: `Was not one of ${typeNames}`,
          test: async (value: undefined | any) => {
            if (!value) return false;

            const res = await Promise.all(types.map(async t => {
              try {
                await t.validate(value);
                return true;
              } catch (e) {
                return false;
              }
            }));

            return res.find(r => r);
          },
        });
    });

    enums.forEach(e => {
      const values = e.getValues().map(v => v.value);
      this._entities[e.name] = yup.mixed()
        .oneOf(values)
        .label(`Enum ${e.name}`);
    })

  }


  getEntity<T extends object = any>(name: string): yup.ObjectSchema<T> | yup.MixedSchema<any> {
    const e = this._entities[name];
    if (!e) throw new Error(`GQL2Yup: No entity '${name}'`);
    return this._entities[name];
  }


  /**
   * Convert a schema to a GraphQLSchema, and extract custom types
   * @param schemaOrString GraphQLSchema, src of schema, or schema file
   */
  private _parse(schemaOrString: GraphQLSchema | string) {
    let schema: GraphQLSchema;

    if (typeof schemaOrString === 'string') {
      let src: string = schemaOrString;
      if (src.startsWith('/') || src.startsWith('.')) src = fs.readFileSync(src).toString();
      schema = buildSchema(src);
    } else schema = schemaOrString;


    const types = Object.values(schema.getTypeMap());

    const enums = types.filter(t => t.astNode?.kind === 'EnumTypeDefinition') as GraphQLEnumType[];

    const objects = types.filter(t =>
      (!DEFAULT_TYPES.includes(t.name)) &&
      !t.name.startsWith('__') &&
      (t as GraphQLObjectType).getFields
    ) as GraphQLObjectType[];

    const unions = types.filter(t =>
      (!DEFAULT_TYPES.includes(t.name)) &&
      !t.name.startsWith('__') &&
      ((t as GraphQLUnionType).toConfig().types)
    ) as GraphQLUnionType[];

    return { schema, objects, unions, enums }
  }


  /**
   * Normalize and get metadata of GraphQL type string (eg: array, required, etc)
   * @param type GraphQL type string
   */
  private _argType(type?: string) {
    if (!type) return;

    let t = type;
    const isRequired = t.endsWith('!');
    if (isRequired) t = t.slice(0, -1);
    const isArray = t.startsWith('[');
    if (isArray) t = t.slice(1, -1);
    let isUnknown = false;

    // Run second bang removal for isArray isRequired
    if (t.endsWith('!')) t = t.slice(0, -1);

    switch (t) {
      case 'Int':
      case 'Float':
        t = 'number';
        break;
      case 'Date':
      case 'DateTime':
        t = 'Date';
        break;
      case 'String':
      case 'Boolean':
      case 'Number':
        t = t.toLowerCase();
        break;
      default:
        t = t;
        isUnknown = true;
    }

    return {
      type: t as ArgType,
      isArray,
      isRequired,
      isUnknown
    };
  };


  /**
   * Convert a GraphQL field to a yup validation object
   * @param field GraphQLField to convert to Yup
   */
  private _fieldToYup(field: Field): [string, YupType] {
    const {
      isArray,
      isRequired,
      type
    } = this._argType(field.type.toString())!;

    let base: YupType;
    let lazy = false;

    switch (type) {
      case 'boolean':
      case 'number':
      case 'string':
        base = yup[type.toLowerCase()]();
        break;

      case 'Date':
      case 'DateTime':
        const { _dateFormats } = this;
        base = yup.mixed()
        // This needs to be done before the test for sequential testing
        if (isRequired) base = (base as yup.MixedSchema).required();

        base = (base as yup.MixedSchema).test({
          name: 'Valid date',
          message: 'Invalid date format',
          test: (value: any) => {
            if (value === undefined || value === null) return true; // Skip
            if (value instanceof Date) return true;
            if (typeof value !== 'string') return false;

            try {
              value = moment(value, _dateFormats);
              return value.isValid();
            } catch (e) { return false }
          }
        });
        break;

      default:
        lazy = true;
        base = yup.lazy(() => {
          let e = this._entities[type];
          if (isArray) return e.required();
          else return e;
        })
    }

    if (!lazy) base = (base as yup.ObjectSchema).nullable(!isRequired);
    if (isArray) base = yup.array().of(base);

    return [field.name, base];
  };

}


export default GQL2Yup;
