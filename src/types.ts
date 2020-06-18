import { GraphQLField, GraphQLFieldMap } from 'graphql';
import * as yup from 'yup';

export type MODE = 'yup' | 'text'; // yup = generate yup object, text = generate file

export type FieldMap = GraphQLFieldMap<any, { [key: string]: any; }>;
export type Field = GraphQLField<any, { [key: string]: any; }>;

export type ArgType = 'number' | 'Date' | 'string' | 'boolean' | 'number';
export type YupType = yup.ObjectSchema | yup.ArraySchema<any> | yup.Lazy
