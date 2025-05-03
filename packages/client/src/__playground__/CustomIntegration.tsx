/* eslint-disable */
import FormField from 'scripts/react/components/FormField';
import { type Configuration } from '@perseid/form';
import { Id, type DefaultDataModel, type I18n } from '@perseid/core';
import type { TestStore } from '__playground__/react';
import * as React from 'react';
import Form from '@perseid/form/react';
// import DefaultMenu from 'scripts/react/components/Menu';
import DefaultActionsWrapper from 'scripts/react/components/ActionsWrapper';

function CustomIntegration({
  services,
  components,

}: ReactCommonProps<DefaultDataModel, I18n, TestStore>): JSX.Element {
  services.store.a();
  const ActionsWrapper = components.ActionsWrapper ?? DefaultActionsWrapper;
  const { log } = console;
  services.store.delete('users', new Id()).catch((e: unknown) => { log(e); });
  return (
    <div>

      <Form
        Field={FormField({
          test: {
            component: 'Array',
          },
          testNew: {
            component: 'Array',
          },
          'test.$n': {
            component: 'Object',
          },
          'test.$n.test1': {
            component: 'Textfield',
          },
          'test.$n.test2': {
            component: 'Textfield',
          },
          'testNew.$n': {
            component: 'Object',
          },
          'testNew.$n.test1': {
            component: 'Textfield',
          },
          'testNew.$n.test2': {
            component: 'Textfield',
          },
          submit: {
            component: 'Button',
          },
          'next.1.end': {
            component: 'Textfield',
          },
          'next.1.submit': {
            component: 'Button',
          },
        }, { prefix: '', services })}
        configuration={{
          root: 'root',
          // submitPartialUpdates: false,
          initialValues: {
            test: [{
              test1: 'a',
              test2: null,
            }],
          },
          plugins: [
            (engine): void => {
              engine.on('userAction', async (data, next) => {
                log('userAction', data);
                return next(data);
              });
              engine.on('submit', async (data, next) => {
                log('UB', data);
                return next(data);
              });
            },
          ],
          // cache: {
          //   async delete(key) {
          //     await idb.del(key);
          //   },
          //   async get(key) {
          //     const result = await idb.get(key);
          //     return result ?? null;
          //   },
          //   async set(key, value) {
          //     await idb.set(key, value)
          //   }
          // },
          fields: {
            test: {
              type: 'array',
              required: true,
              fields: {
                type: 'object',
                required: true,
                fields: {
                  test1: { type: 'string' },
                  test2: { type: 'string' },
                },
              },
            },
            testNew: {
              type: 'array',
              fields: {
                type: 'object',
                required: true,
                fields: {
                  test1: { type: 'string' },
                  test2: { type: 'string' },
                },
              },
            },
            end: { type: 'string' },
            submit: {
              type: 'null',
              submit: true,
            },
          },
          steps: {
            root: {
              fields: ['testNew', 'submit'],
              nextStep: 'next',
            },
            next: {
              submit: true,
              fields: ['end', 'submit'],
            },
          },
        } as Configuration}
      />
      <ActionsWrapper
        resource="users"
        components={components}
        services={services}
      />
    </div>
  );
}

export default React.memo(CustomIntegration);
