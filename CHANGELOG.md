## @perseid/client:2.0.1 (2024-08-28)

### Bugs
- Fix unecessary `/_model` API calls when data model fragment already exists locally
- Correctly download data model fragment when necessary in `Store.getPageData` method


## @perseid/server:2.0.4 (2024-08-26)

### Bugs
- Whitelist all headers by default in all endpoints
- Fix package bundle configuration that generated issues with `instanceof` statements
- Fix `viewMe` endpoint `authenticate` setting in `FastifyController` service


## @perseid/client:2.0.0 (2024-08-19)

### Breaking changes
- Major NPM dependencies update
- Drop support of `node` < `20` and `npm` < `9`
- Simplify `Store.goBack` method
- Remove `Store.updateModel` method
- Make `ApiClient` service extend `HttpClient`
- Handle data model updates internally in `ApiClient`
- Rename `collection` into `resource` in all codebase
- Fix condition for access token refresh in `ApiClient.request` method
- Throw errors if endpoints do not exist in configuration in all `ApiClient` methods
- Make form fields labels and props configurable from both path and canonical path

### Features
- Add new `ApiClient.viewMe` method
- Add support for `filters` in `ApiClient.buildQuery` method
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports

### Bugs
- Correctly export `HttpError`
- Add missing `change` event handler in `Options` type in `FormField`

### Improvements
- Improve documentation and types definitions


## @perseid/ui:4.0.1 (2024-08-13)

### Bugs
- Fix SCSS export paths in `package.json`
- Fix syntax errors in the generated React bundle


## @perseid/form:4.0.0 (2024-08-11)

### Breaking changes
- Major NPM dependencies update
- Drop support of `node` < `20` and `npm` < `9`
- Remove `defaultValue` field configuration
- Step component now always re-mounts when it gets active
- Prevent glitch issues when focusing in/out of the window
- Move all step-related HTML into the `DefaultStep` component
- Rename `DefaultField` `active` prop into `isActive`
- Rename `DefaultField` `required` prop into `isRequired`
- Throw errors when trying to get configurations for invalid paths
- Replace deep merge by shallow merge in `Engine.setVariables` method
- Add new `activeStep`, `setActiveStep` props to the `DefaultField` component
- Add new `onFocus`, `activeStep` and `setActiveStep` props to the `DefaultStep` component

### Features
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports

### Bugs
- Force inputs processing on user actions
- Force whole optional objects submission on change
- Fix cache clearing on hook error and form submission
- Fix `Engine.areEqual` method with `date` or `binary` data types
- Prevent infinite loops when calling `Engine.setVariables` method in hooks
- Prevent arrays from being filled with initial values when user adds a new item

### Improvements
- Improve `Engine` code consistency


## @perseid/ui:4.0.0 (2024-08-09)

### Breaking changes
- Major NPM dependencies update
- Drop support of `node` < `20` and `npm` < `9`
- Replace built-in SASS classes by placeholders, and generate actual CSS classes only when calling the new `init` mixin

### Features
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports

## @perseid/form:4.0.0 (2024-08-11)

### Breaking changes
- Major NPM dependencies update
- Drop support of `node` < `20` and `npm` < `9`
- Remove `defaultValue` field configuration
- Step component now always re-mounts when it gets active
- Prevent glitch issues when focusing in/out of the window
- Move all step-related HTML into the `DefaultStep` component
- Rename `DefaultField` `active` prop into `isActive`
- Rename `DefaultField` `required` prop into `isRequired`
- Throw errors when trying to get configurations for invalid paths
- Replace deep merge by shallow merge in `Engine.setVariables` method
- Add new `activeStep`, `setActiveStep` props to the `DefaultField` component
- Add new `onFocus`, `activeStep` and `setActiveStep` props to the `DefaultStep` component

### Features
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports

### Bugs
- Force inputs processing on user actions
- Force whole optional objects submission on change
- Fix cache clearing on hook error and form submission
- Fix `Engine.areEqual` method with `date` or `binary` data types
- Prevent infinite loops when calling `Engine.setVariables` method in hooks
- Prevent arrays from being filled with initial values when user adds a new item

### Improvements
- Improve `Engine` code consistency


## @perseid/ui:4.0.0 (2024-08-09)

### Breaking changes
- Major NPM dependencies update
- Drop support of `node` < `20` and `npm` < `9`
- Replace built-in SASS classes by placeholders, and generate actual CSS classes only when calling the new `init` mixin

### Features
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports


## @perseid/jobs:2.0.0 (2024-08-09)

### Breaking changes
- Major NPM dependencies update
- `mongodb` is now a peer dependency
- Drop support of `node` < `20` and `npm` < `9`
- Automatically cast `lastCompletedAt` metadata when running a task
- Refactor `DatabaseClient` into an abstract service to support multiple DBMS

### Features
- Add new `MongoDatabaseClient` service
- Add new `MySQLDatabaseClient` service
- Add new `PostgreSQLDatabaseClient` service
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports

### Improvements
- Improve types definitions


## @perseid/server:2.0.3 (2024-08-09)

### Bugs
- Fix types definitions


## @perseid/server:2.0.2 (2024-08-08)

### Improvements
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports


## @perseid/store:8.0.1 (2024-08-08)

### Improvements
- Improve types definitions
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports


## @perseid/dev-kit:10.0.0 (2024-08-08)

### Breaking changes
- Major NPM dependencies update
- Change `jsx` configuration value to `react-jsx` in `tsconfig.json`

### Features
- Add `exports` configuration in `package.json` to enable support for native sub-modules imports


## @perseid/server:2.0.1 (2024-08-08)

### Bugs
- Fix types definitions
- Move `FastifyController` service into `@perseid/server/fastify` to respect peer dependencies
- Move `ExpressController` service into `@perseid/server/express` to respect peer dependencies
- Move `MySQLDatabaseClient` service into `@perseid/server/mysql` to respect peer dependencies
- Move `MongoDatabaseClient` service into `@perseid/server/mongodb` to respect peer dependencies
- Move `PostgreSQLDatabaseClient` service into `@perseid/server/postgresql` to respect peer dependencies


## @perseid/store:8.0.0 (2024-08-07)

### Breaking changes
- Major NPM dependencies update
- Drop support of `node` < `20` and `npm` < `9`


## @perseid/server:2.0.0 (2024-08-07)

### Breaking changes
- Major NPM dependencies update
- Drop support of `node` < `20` and `npm` < `9`
- `fastify` and `mongodb` are now peer dependencies
- RBAC is now handled in engine instead of controller
- Update `EmailClient` to extend `HttpClient`
- Update `CacheClient` to extend `HttpClient`
- Update `BucketClient` to extend `HttpClient`
- Refactor `Engine` and `UsersEngine` services for better consistency
- Refactor `DatabaseClient` into an abstract service to support multiple DBMS
- Refactor `Controller` into an abstract service to support multiple API frameworks

### Features
- Add new `FastifyController` service
- Add new `ExpressController` service
- Add new `MongoDatabaseClient` service
- Add new `MySQLDatabaseClient` service
- Add new `PostgreSQLDatabaseClient` service

### Improvements
- Improve types definitions and documentation


## @perseid/core:2.0.1(2024-07-19)

### Bugs
- Fix types definitions


## @perseid/core:2.0.0 (2024-07-18)

### Breaking changes
- Drop support of `node` < `20` and `npm` < `9`
- Add `isUnique` constraint to `_id` data model field
- Remove `default` key from data model fields schemas
- Remove `customType` key from data model fields schemas
- Rename `Model.getCollections` method into `Model.getResources`
- Rename `required` into `isRequired` in data model fields schemas
- Rename all `Collection*` types definitions into `Resource*` to improve DBMS agnosticism
- Rename `unique` into `isUnique` and `index` into `isIndexed` in data model fields schemas

### Features
- Add new `HttpClient` generic service

### Improvements
- Improve types definitions


## @perseid/dev-kit:9.0.0 (2024-07-18)

### Breaking changes
- Major NPM dependencies update
- Drop support of `node` < `20` and `npm` < `9`
- Enable `verbatimModuleSyntax` TypeScript configuration by default
- Disable `react/jsx-uses-react` and `react/react-in-jsx-scope` ESLint rules by default


## @perseid/client:1.0.0 (2024-04-03)

### General
- Initial stable release


## @perseid/ui:3.0.2 (2024-01-09)

### Improvements
- Improve default theme


## @perseid/server:1.1.0 (2024-01-09)

### Features
- Add new `handleCORS` setting to `FastifyController`


## @perseid/form:3.0.4 (2024-01-06)

### Bugs
- Fix fields `validation` function `inputs` argument
- Fix Vue `Form` component implementation

### Improvements
- Minor NPM dependencies update


## @perseid/ui:3.0.1 (2024-01-05)

### Bugs
- Fix `extend` mixin


## @perseid/ui:3.0.0 (2024-01-05)

### General
- This package is now the official version of [biuty](https://github.com/openizr/biuty), which is no longer maintained
- To see the complete changelog before version 3.0.0, please refer to [biuty](https://github.com/openizr/biuty/releases)

### Breaking changes
- Drop support of Node < 18 & NPM < 8
- Major NPM dependencies update
- `flex: 1 1 auto` is not automatically applied anymore to the children of a `flex-auto` container

### Bugs
- Fix native body layout
- Fix library tree shaking for React
- Fix `text-left` and `text-right` CSS helpers
- Grid columns are now always evenly distributed
- Reinstate default props assignation for Svelte (see [this issue](https://github.com/sveltejs/svelte/issues/5673))


## @perseid/store:7.0.2 (2024-01-05)

### Bugs
- Fix types definitions


## @perseid/form:3.0.3 (2023-12-23)

### Improvements
- Minor NPM dependencies update


## @perseid/form:3.0.2 (2023-12-23)

### Improvements
- Improve types definitions


## @perseid/form:3.0.1 (2023-12-23)

### Bugs
- Fix optional `object` and `array` fields values handling


## @perseid/form:3.0.0 (2023-12-23)

### General
- This package is now the official version of [gincko](https://github.com/openizr/gincko), which is no longer maintained
- To see the complete changelog before version 3.0.0, please refer to [gincko](https://github.com/openizr/gincko/releases)

### Breaking changes
- Remove `biuty` dependency
- Major NPM dependencies update
- Decouple `fields` and `steps` in configuration
- Empty string values are now transformed to `null` in final user inputs
- Built-in React, Svelte and Vue form fields now only output JSON fields data
- Remove `dynamicObject` field type, which can be replaced by a mix of `array` and `object` fields
- Major form engine refactoring and performance improvement, up to x10 on forms with hundreds of fields
- `fields` configuration entry now only describe expected data model and behaviour and not UI rendering

### Features
- Add new publis `isEmpty` to the form engine
- Add new `onSubmit` configuration entry, to make form submissions handling easier than through plugins
- Add new `Layout`, `Step`, `Loader` and `Field` Form props in all integrations, to make UI fully customizable

### Bugs
- Form fields are now recursively updated until no change needs to be made anymore

### Improvements
- Improve types definitions
- Fields with type `null` can now be submitted
- Improve optional `object` and `array` fields handling


## @perseid/store:7.0.1 (2023-12-22)

### Improvements
- Improve types definitions
- Prevent router from sending unecessary state notifications to subscriptions when navigating to the exact same page


## @perseid/store:7.0.0 (2023-12-22)

### General
- This package is now the official version of [diox](https://github.com/openizr/diox), which is no longer maintained
- To see the complete changelog before version 7.0.0, please refer to [diox](https://github.com/openizr/diox/releases)

### Improvements
- Minor NPM dependencies update
- Prevent `router` module from sending unecessary notifications to subscriptions when navigating to the exact same page


## @perseid/dev-kit:8.0.1 (2023-12-22)

### Bugs
- Fix missing NPM dependency causing issues with Node-related global variables


## @perseid/dev-kit:8.0.0 (2023-12-21)

### Breaking changes
- Major NPM dependencies update

### Improvements
- Add support for `*.d.ts` files imports


## @perseid/jobs:1.0.0 (2023-11-28)

#### General
- Initial stable release


## @perseid/server:1.0.0 (2023-11-27)

### General
- Initial stable release


## @perseid/dev-kit:7.0.0 (2023-11-25)

### General
- This package is now the official version of [typescript-dev-kit](https://github.com/openizr/typescript-dev-kit), which is no longer maintained
- To see the complete changelog before version 7.0.0, please refer to [typescript-dev-kit](https://github.com/openizr/typescript-dev-kit/releases)

### Breaking changes
- Major NPM dependencies update
- `tsconfig` `skipLibCheck` option is now set to `false`
- Remove unused `doc` and `init` commands

### Features
- `devServer.port` and `devServer.host` now accepts environment variables as a value

### Bugs
- Fix a bug making Vitest generate another `node_modules` directory when running `test` command
- The `devKitConfig.banner` option is now optional
- The `eslintConfig` option is now optional in `package.json` (files checking is skipped if this option is not present)

### Improvements
- The `package.json` `test`,`dev`, `check` and `build` commands scripts are now independant from the directory they are called from


## @perseid/core:1.0.0 (2023-11-25)

### General
- Initial stable release