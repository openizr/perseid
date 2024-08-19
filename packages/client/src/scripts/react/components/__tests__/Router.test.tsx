/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @vitest-environment jsdom
 */

import { act, render } from '@testing-library/react';
import Router from 'scripts/react/components/Router';

type Services = CommonProps['services'];

describe('react/components/Router', () => {
  vi.mock('scripts/react/pages/Error');
  vi.mock('scripts/react/components/Layout');
  vi.mock('scripts/react/components/Loader');
  vi.mock('@perseid/store/connectors/react');
  vi.mock('scripts/react/components/ErrorWrapper');
  vi.mock('scripts/react/components/ConfirmationModal');
  vi.mock('scripts/react/pages/List', () => ({ default: (): JSX.Element => <div /> }));
  vi.mock('scripts/react/pages/View', () => ({ default: (): JSX.Element => <div /> }));
  vi.mock('scripts/react/pages/SignIn', () => ({ default: (): JSX.Element => <div /> }));
  vi.mock('scripts/react/pages/SignUp', () => ({ default: (): JSX.Element => <div /> }));
  vi.mock('scripts/react/pages/UpdateUser', () => ({ default: (): JSX.Element => <div /> }));
  vi.mock('scripts/react/pages/VerifyEmail', () => ({ default: (): JSX.Element => <div /> }));
  vi.mock('scripts/react/pages/ResetPassword', () => ({ default: (): JSX.Element => <div /> }));
  vi.mock('scripts/react/pages/CreateOrUpdate', () => ({ default: (): JSX.Element => <div /> }));

  const components = {};
  const services = {
    store: {
      getAllRoutes: vi.fn(() => [
        'test',
        'list',
        'view',
        'signIn',
        'signUp',
        'update',
        'create',
        'updateUser',
        'verifyEmail',
        'resetPassword',
      ]),
      getPage: vi.fn((page: string) => ({
        test: { component: 'Test' },
        list: { component: 'List' },
        view: { component: 'View' },
        signIn: { component: 'SignIn' },
        signUp: { component: 'SignUp' },
        update: { component: 'Update' },
        create: { component: 'Create' },
        updateUser: { component: 'UpdateUser' },
        verifyEmail: { component: 'VerifyEmail' },
        resetPassword: { component: 'ResetPassword' },
      }[page])),
    },
  } as unknown as Services;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PAGE;
    delete process.env.ERROR;
    delete process.env.NOT_FOUND;
  });

  test('renders correctly - page not found', () => {
    process.env.NOT_FOUND = 'true';
    const { container } = render(
      <Router
        pages={{}}
        services={services}
        components={components}
      />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - other error', async () => {
    process.env.ERROR = 'true';
    let container: HTMLElement = document.createElement('div');
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          container={container}
          components={components}
        />,
      )).container;
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - page found, no component', async () => {
    process.env.PAGE = 'test';
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValueOnce(818);
    let container: HTMLElement = document.createElement('div');
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  test('renders correctly - page found, component', async () => {
    process.env.PAGE = 'test';
    let container: HTMLElement = document.createElement('div');
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          services={services}
          components={components}
          pages={{
            Test: () => Promise.resolve({
              default: () => (
                <div id="page" />
              ),
            }),
          }}
        />,
      )).container;
    });
    expect(container.firstChild).toMatchSnapshot();
    process.env.PAGE = 'list';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    process.env.PAGE = 'view';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    process.env.PAGE = 'signIn';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    process.env.PAGE = 'signUp';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    process.env.PAGE = 'update';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    process.env.PAGE = 'create';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    process.env.PAGE = 'updateUser';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    process.env.PAGE = 'verifyEmail';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
    process.env.PAGE = 'resetPassword';
    await act(async () => {
      container = (await (render as unknown as (ui: unknown) => Promise<{
        container: HTMLElement;
      }>)(
        <Router
          pages={{}}
          services={services}
          components={components}
        />,
      )).container;
    });
  });
});
