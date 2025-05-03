// import { toSnakeCase } from '@perseid/core';

// export interface GinckoFormatters {
//   [type: string]: (
//     schema: any,
//     prefix: string,
//   ) => any;
// }

// export default async function getTranslations(store: any, model: any, config: any,
// placeholder = 'Toto'): Promise<void> {
//   let formLabels: any = [];
//   const formatters: GinckoFormatters = {
//     null(_schema, prefix) {
//       formLabels.push(`${prefix}.LABEL`);
//     },
//     id: (schema, prefix) => {
//       formLabels.push(`${prefix}.LABEL`);
//       if (schema.enum !== undefined) {
//         formLabels.push(`${prefix}.PLACEHOLDER`);
//         schema.enum.forEach((option: any) => {
//           // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
//           formLabels.push(`${prefix}.OPTIONS.${option}`.toUpperCase());
//         });
//       }
//       if (schema.relation === undefined) {
//         formLabels.push(`${prefix}.ERRORS.PATTERN_VIOLATION`);
//       }
//       if (schema.required) {
//         formLabels.push(`${prefix}.ERRORS.REQUIRED`);
//       }
//     },
//     binary(schema, prefix) {
//       formLabels.push(`${prefix}.LABEL`);
//       if (schema.required) {
//         formLabels.push(`${prefix}.ERRORS.REQUIRED`);
//       }
//     },
//     boolean(schema, prefix) {
//       formLabels.push(`${prefix}.LABEL`);
//       formLabels.push(`${prefix}.OPTIONS.TRUE`);
//       if (schema.required) {
//         formLabels.push(`${prefix}.ERRORS.REQUIRED`);
//       }
//     },
//     date(schema, prefix) {
//       formLabels.push(`${prefix}.LABEL`);
//       if (schema.required) {
//         formLabels.push(`${prefix}.ERRORS.REQUIRED`);
//       }
//       if (schema.enum !== undefined) {
//         formLabels.push(`${prefix}.PLACEHOLDER`);
//         schema.enum.forEach((option: any) => {
//           // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
//           formLabels.push(`${prefix}.OPTIONS.${option}`.toUpperCase());
//         });
//       }
//       if (schema.pattern !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.PATTERN_VIOLATION`);
//       }
//     },
//     float(schema, prefix) {
//       formLabels.push(`${prefix}.LABEL`);
//       formLabels.push(`${prefix}.ERRORS.NOT_A_NUMBER`);
//       if (schema.required) {
//         formLabels.push(`${prefix}.ERRORS.REQUIRED`);
//       }
//       if (schema.enum !== undefined) {
//         formLabels.push(`${prefix}.PLACEHOLDER`);
//         schema.enum.forEach((option: any) => {
//           // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
//           formLabels.push(`${prefix}.OPTIONS.${option}`.toUpperCase());
//         });
//       }
//       if (schema.pattern !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.PATTERN_VIOLATION`);
//       }
//       if (schema.minimum !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.BELOW_MINIMUM`);
//       }
//       if (schema.exclusiveMinimum !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.BELOW_STRICT_MINIMUM`);
//       }
//       if (schema.maximum !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.ABOVE_MAXIMUM`);
//       }
//       if (schema.exclusiveMaximum !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.ABOVE_STRICT_MAXIMUM`);
//       }
//     },
//     integer(schema, prefix) {
//       formLabels.push(`${prefix}.LABEL`);
//       formLabels.push(`${prefix}.ERRORS.NOT_A_NUMBER`);
//       if (schema.required) {
//         formLabels.push(`${prefix}.ERRORS.REQUIRED`);
//       }
//       if (schema.enum !== undefined) {
//         formLabels.push(`${prefix}.PLACEHOLDER`);
//         schema.enum.forEach((option: any) => {
//           // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
//           formLabels.push(`${prefix}.OPTIONS.${option}`.toUpperCase());
//         });
//       }
//       if (schema.pattern !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.PATTERN_VIOLATION`);
//       }
//       if (schema.minimum !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.BELOW_MINIMUM`);
//       }
//       if (schema.exclusiveMinimum !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.BELOW_STRICT_MINIMUM`);
//       }
//       if (schema.maximum !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.ABOVE_MAXIMUM`);
//       }
//       if (schema.exclusiveMaximum !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.ABOVE_STRICT_MAXIMUM`);
//       }
//     },
//     string(schema, prefix) {
//       formLabels.push(`${prefix}.LABEL`);
//       if (schema.required) {
//         formLabels.push(`${prefix}.ERRORS.REQUIRED`);
//       }
//       if (schema.enum !== undefined) {
//         formLabels.push(`${prefix}.PLACEHOLDER`);
//         schema.enum.forEach((option: any) => {
//           // Don't snakecase here, otherwise options like "TOTO" become "T_O_T_O"
//           formLabels.push(`${prefix}.OPTIONS.${option}`.toUpperCase());
//         });
//       }
//       if (schema.pattern !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.PATTERN_VIOLATION`);
//       }
//       if (schema.minLength !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.VALUE_TOO_SHORT`);
//       }
//       if (schema.maxLength !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.VALUE_TOO_LONG`);
//       }
//     },
//     object: (schema, prefix) => {
//       formLabels.push(`${prefix}.LABEL`);
//       Object.keys(schema.fields).forEach((key) => {
//         const field = schema.fields[key];
//         if (key[0] !== '_') {
//           const formatter = formatters[field.type] ?? formatters.null;
//           formatter(schema.fields[key], `${prefix}.${toSnakeCase(key)}`);
//         }
//       });
//     },
//     dynamicObject: (schema, prefix) => {
//       const formatter = formatters[schema.fields.type] ?? formatters.null;
//       formLabels.push(`${prefix}.LABEL`);
//       formLabels.push(`${prefix}.FIELDS.KEY`);
//       formatter(schema.fields, `${prefix}.${'PATTERNS_0'}`);
//       if (schema.minItems !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.TOO_FEW_ITEMS`);
//       }
//       if (schema.maxItems !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.TOO_MANY_ITEMS`);
//       }
//     },
//     array: (schema, prefix) => {
//       const formatter = formatters[schema.fields.type] ?? formatters.null;
//       formLabels.push(`${prefix}.LABEL`);
//       formatter(schema.fields, `${prefix}.FIELDS`);
//       if (schema.uniqueItems !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.DUPLICATE_ITEMS`);
//       }
//       if (schema.minItems !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.TOO_FEW_ITEMS`);
//       }
//       if (schema.maxItems !== undefined) {
//         formLabels.push(`${prefix}.ERRORS.TOO_MANY_ITEMS`);
//       }
//     },
//   };
//   await Promise.all(Object.keys(config.collections).map((c) => store.updateModel(c)));
//   console.log('TAKE THAT');
//   console.log({
//     FALLBACK: placeholder,
//     LOADER: {
//       TITLE: placeholder,
//     },
//     PAGINATION: {
//       NEXT: placeholder,
//       PREVIOUS: placeholder,
//     },
//     NAVIGATION: {
//       GO_BACK: placeholder,
//     },
//     MENU: {
//       ITEMS: {
//         TITLE: placeholder,
//       },
//       UPDATE_USER: placeholder,
//       SIGN_OUT: placeholder,
//       ...Object.keys(config.collections).reduce((acc, collection) => (
//         config.collections[collection].list ? ({
//           ...acc,
//           [toSnakeCase(collection)]: placeholder,
//         })
//           : acc), {}),
//     },
//     NOTIFICATIONS: {
//       UPDATED_USER: placeholder,
//       RESET_PASSWORD: placeholder,
//       REQUESTED_EMAIL: placeholder,
//       UPDATED_RESOURCE: placeholder,
//       DELETED_RESOURCE: placeholder,
//       ERRORS: {
//         UNKNOWN: placeholder,
//         FORBIDDEN: placeholder,
//         NOT_FOUND: placeholder,
//         USER_EXISTS: placeholder,
//         RESOURCE_EXISTS: placeholder,
//         RESOURCE_REFERENCED: placeholder,
//         INVALID_CREDENTIALS: placeholder,
//         INVALID_RESET_TOKEN: placeholder,
//         INVALID_VERIFICATION_TOKEN: placeholder,
//       },
//     },
//     PAGES: {
//       ERROR: {
//         FORBIDDEN: {
//           TITLE: placeholder,
//           SUBTITLE: placeholder,
//           CTA: placeholder,
//         },
//         NOT_FOUND: {
//           TITLE: placeholder,
//           SUBTITLE: placeholder,
//           CTA: placeholder,
//         },
//         GENERIC: {
//           TITLE: placeholder,
//           SUBTITLE: placeholder,
//           CTA: placeholder,
//         },
//       },
//       UPDATE_USER: {
//         TITLE: placeholder,
//         EMAIL: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//             PATTERN_VIOLATION: placeholder,
//           },
//         },
//       },
//       VERIFY_EMAIL: {
//         TITLE: placeholder,
//         SUBTITLE: placeholder,
//         CTA: placeholder,
//       },
//       SIGN_UP: {
//         TITLE: placeholder,
//         SIGN_IN: placeholder,
//         EMAIL: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//             PATTERN_VIOLATION: placeholder,
//           },
//         },
//         PASSWORD: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//             PATTERN_VIOLATION: placeholder,
//             PASSWORDS_MISMATCH: placeholder,
//           },
//         },
//         PASSWORD_CONFIRMATION: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//             PATTERN_VIOLATION: placeholder,
//             PASSWORDS_MISMATCH: placeholder,
//           },
//         },
//         SUBMIT: {
//           LABEL: placeholder,
//         },
//       },
//       SIGN_IN: {
//         TITLE: placeholder,
//         SIGN_UP: placeholder,
//         FORGOT_PASSWORD: placeholder,
//         SUBMIT: {
//           LABEL: placeholder,
//         },
//         EMAIL: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//           },
//         },
//         PASSWORD: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//           },
//         },
//       },
//       RESET_PASSWORD: {
//         SIGN_IN: placeholder,
//         TITLE: {
//           LABEL: placeholder,
//         },
//         EMAIL: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//             PATTERN_VIOLATION: placeholder,
//           },
//         },
//         PASSWORD: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//             PATTERN_VIOLATION: placeholder,
//             PASSWORDS_MISMATCH: placeholder,
//           },
//         },
//         PASSWORD_CONFIRMATION: {
//           LABEL: placeholder,
//           ERRORS: {
//             REQUIRED: placeholder,
//             PATTERN_VIOLATION: placeholder,
//             PASSWORDS_MISMATCH: placeholder,
//           },
//         },
//         SUBMIT: {
//           LABEL: placeholder,
//         },
//         SUCCESS_TITLE: {
//           LABEL: placeholder,
//         },
//         SUCCESS_MESSAGE: {
//           LABEL: placeholder,
//         },
//       },
//       ...Object.keys(config.collections).reduce((acc, collection) => {
//         const collectionLabels: any = {};
//         if (config.collections[collection].view?.componentProps?.fields) {
//           collectionLabels.VIEW = {
//             FIELDS: {},
//             CONFIRM_DELETION: {
//               TITLE: placeholder,
//               SUBTITLE: placeholder,
//               CONFIRM: placeholder,
//               CANCEL: placeholder,
//             },
//           };
//           collectionLabels.VIEW.FIELDS = config.collections[collection]
//             .view.componentProps.fields.reduce((view: any, field: string) => ({
//               ...view,
//               [`${toSnakeCase(field.replace(/\./g, '__'))}`]: { LABEL: placeholder },
//             }), {});
//         }
//         if (config.collections[collection].list?.componentProps?.fields) {
//           collectionLabels.LIST = {
//             FIELDS: {},
//             TABLE: {
//               LOADING: placeholder,
//               ACTIONS: placeholder,
//               NO_RESULT: placeholder,
//             },
//             TOGGLE_FILTERS: placeholder,
//             SEARCH_PLACEHOLDER: placeholder,
//             CONFIRM_DELETION: {
//               TITLE: placeholder,
//               SUBTITLE: placeholder,
//               CONFIRM: placeholder,
//               CANCEL: placeholder,
//             },
//           };
//           collectionLabels.LIST.FIELDS = config.collections[collection]
//             .list.componentProps.fields.reduce((list: any, field: string) => ({
//               ...list,
//               [`${toSnakeCase(field.replace(/\./g, '__'))}`]: { LABEL: placeholder },
//             }), {});
//         }
//         if (config.collections[collection].create) {
//           formLabels = [];
//           collectionLabels.CREATE = { FIELDS: { SUBMIT: { LABEL: placeholder } } };
//           const schema = { type: 'object', fields: model.get(collection).schema.fields };
//           const formatter = (formatters as any)[schema.type];
//           formatter(schema, 'FIELDS');
//           formLabels.slice(1).forEach((label: any) => {
//             const splitted = label.split('.');
//             let curr = collectionLabels.CREATE;
//             while (splitted.length > 0) {
//               const sub = splitted.shift();
//               curr[sub] ??= splitted.length === 0 ? placeholder : {};
//               curr = curr[sub];
//             }
//           });
//         }
//         if (config.collections[collection].update) {
//           formLabels = [];
//           collectionLabels.UPDATE = { FIELDS: { SUBMIT: { LABEL: placeholder } } };
//           const schema = { type: 'object', fields: model.get(collection).schema.fields };
//           const formatter = (formatters as any)[schema.type];
//           formatter(schema, 'FIELDS');
//           formLabels.slice(1).forEach((label: any) => {
//             const splitted = label.split('.');
//             let curr = collectionLabels.UPDATE;
//             while (splitted.length > 0) {
//               const sub = splitted.shift();
//               curr[sub] ??= splitted.length === 0 ? placeholder : {};
//               curr = curr[sub];
//             }
//           });
//         }
//         return {
//           ...acc,
//           [toSnakeCase(collection)]: collectionLabels,
//         };
//       }, {} as any),
//     },
//   });
// }
