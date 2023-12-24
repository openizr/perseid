/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';
import Menu from 'scripts/react/components/Menu';
import Table from 'scripts/react/components/Table';
import Modal from 'scripts/react/components/Modal';
import Loader from 'scripts/react/components/Loader';
import Router from 'scripts/react/components/Router';
import Notifier from 'scripts/react/components/Notifier';
import FormField from 'scripts/react/components/FormField';
import Pagination from 'scripts/react/components/Pagination';
import FieldValue from 'scripts/react/components/FieldValue';
import FieldLabel from 'scripts/react/components/FieldLabel';
import PageLayout from 'scripts/react/components/PageLayout';
import LazyOptions from 'scripts/react/components/LazyOptions';
import NestedFields from 'scripts/react/components/NestedFields';
import OptionalField from 'scripts/react/components/OptionalField';
import ActionsWrapper from 'scripts/react/components/ActionsWrapper';
import ConfirmationModal from 'scripts/react/components/ConfirmationModal';
import PermissionsWrapper from 'scripts/react/components/PermissionsWrapper';

export * from 'scripts/core/index';

const ViewPage = (): unknown => import('scripts/react/pages/View');
const ListPage = (): unknown => import('scripts/react/pages/List');
const ErrorPage = (): unknown => import('scripts/react/pages/Error');
const Grid = React.lazy(() => import('scripts/react/components/Grid'));
const SignInPage = (): unknown => import('scripts/react/pages/SignIn');
const SignUpPage = (): unknown => import('scripts/react/pages/SignUp');
const UpdateUserPage = (): unknown => import('scripts/react/pages/UpdateUser');
const VerifyEmailPage = (): unknown => import('scripts/react/pages/VerifyEmail');
const ResetPasswordPage = (): unknown => import('scripts/react/pages/ResetPassword');
const CreateOrUpdatePage = (): unknown => import('scripts/react/pages/CreateOrUpdate');

// Components.
export { ActionsWrapper, ConfirmationModal, FieldLabel };
export { FieldValue, FormField, Grid };
export { LazyOptions, Loader, Menu };
export { Modal, NestedFields, Notifier };
export { OptionalField, PageLayout, Pagination };
export { PermissionsWrapper, Router, Table };

// Pages.
export { ViewPage, ListPage, UpdateUserPage };
export { SignInPage, SignUpPage, CreateOrUpdatePage };
export { ErrorPage, ResetPasswordPage, VerifyEmailPage };
