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
