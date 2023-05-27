// /**
//  * Copyright (c) Openizr. All Rights Reserved.
//  *
//  * This source code is licensed under the MIT license found in the
//  * LICENSE file in the root directory of this source tree.
//  *
//  */

// import model from 'scripts/__mocks__/model';
// import generateCreateSchema from 'scripts/helpers/createSchema';

// describe('server/helpers/createSchema', () => {
//   const createSchema = generateCreateSchema(model);

//   beforeEach(() => {
//     vi.clearAllMocks();
//   });

//   test('correctly generates Ajv schema - valid fields', () => {
//     expect(createSchema('test', model.collections.test.fields)).toMatchSnapshot();
//   });

//   test('correctly generates Ajv schema - valid fields, `isPartial` is `true`', () => {
//     expect(createSchema('test', model.collections.test.fields, true)).toMatchSnapshot();
//   });

//   test('correctly generates Ajv schema - valid fields, `isResponse` is `true`', () => {
//     expect(createSchema('test', model.collections.test.fields, false, true)).toMatchSnapshot();
//   });

//   test('correctly generates Ajv schema - valid fields, response mode', () => {
//     expect(createSchema('test', {
//       'response.2xx': {
//         type: 'object',
//         fields: model.collections.test.fields,
//       },
//     }, false, true)).toMatchSnapshot();
//   });

//   test('correctly generates Ajv schema - invalid fields', () => {
//     const fields = { invalid: { type: 'test' } };
//     expect(createSchema('test', fields)).toMatchSnapshot();
//   });
// });
