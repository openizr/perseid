/**
 * Copyright (c) Openizr. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import Menu from 'scripts/vue/components/Menu.vue';
import Table from 'scripts/vue/components/Table.vue';
import Modal from 'scripts/vue/components/Modal.vue';
import Loader from 'scripts/vue/components/Loader.vue';
import Router from 'scripts/vue/components/Router.vue';
import Notifier from 'scripts/vue/components/Notifier.vue';
import FormField from 'scripts/vue/components/FormField.vue';
import Pagination from 'scripts/vue/components/Pagination.vue';
import FieldValue from 'scripts/vue/components/FieldValue.vue';
import FieldLabel from 'scripts/vue/components/FieldLabel.vue';
import PageLayout from 'scripts/vue/components/PageLayout.vue';
import { defineAsyncComponent, type DefineComponent } from 'vue';
import LazyOptions from 'scripts/vue/components/LazyOptions.vue';
import NestedFields from 'scripts/vue/components/NestedFields.vue';
import OptionalField from 'scripts/vue/components/OptionalField.vue';
import ActionsWrapper from 'scripts/vue/components/ActionsWrapper.vue';
import ConfirmationModal from 'scripts/vue/components/ConfirmationModal.vue';
import PermissionsWrapper from 'scripts/vue/components/PermissionsWrapper.vue';

const ViewPage = (): unknown => import('scripts/vue/pages/View.vue');
const ListPage = (): unknown => import('scripts/vue/pages/List.vue');
const ErrorPage = (): unknown => import('scripts/vue/pages/Error.vue');
const Grid = defineAsyncComponent({
  loader: (() => import('scripts/vue/components/Grid.vue')) as unknown as () => Promise<DefineComponent>,
});
const SignInPage = (): unknown => import('scripts/vue/pages/SignIn.vue');
const SignUpPage = (): unknown => import('scripts/vue/pages/SignUp.vue');
const UpdateUserPage = (): unknown => import('scripts/vue/pages/UpdateUser.vue');
const VerifyEmailPage = (): unknown => import('scripts/vue/pages/VerifyEmail.vue');
const ResetPasswordPage = (): unknown => import('scripts/vue/pages/ResetPassword.vue');
const CreateOrUpdatePage = (): unknown => import('scripts/vue/pages/CreateOrUpdate.vue');

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
