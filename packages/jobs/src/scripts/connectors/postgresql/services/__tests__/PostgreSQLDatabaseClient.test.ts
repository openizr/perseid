// /**
//  * Copyright (c) Openizr. All Rights Reserved.
//  *
//  * This source code is licensed under the MIT license found in the
//  * LICENSE file in the root directory of this source tree.
//  *
//  */

// import { Id } from '@perseid/core';
// import { CacheClient, Telemetry } from '@perseid/server';
// import PostgreSQLDatabaseClient from 'scripts/connectors/postgresql/services/PostgreSQLDatabaseClient';

// type TestDatabase = PostgreSQLDatabaseClient & {
//   client: PostgreSQLDatabaseClient['client'];
//   database: PostgreSQLDatabaseClient['database'];
//   formatTasks: PostgreSQLDatabaseClient['formatTasks'];
// };

// describe('postgresql/services/PostgreSQLDatabaseClient', () => {
//   vi.mock('pg');
//   vi.mock('@perseid/core');
//   vi.mock('@perseid/server');
//   vi.mock('@perseid/server/postgresql');
//   vi.mock('scripts/core/model/index');
//   vi.setSystemTime(new Date(2022, 0, 1));

//   let databaseClient: TestDatabase;
//   const telemetry = new Telemetry({ logLevel: 'debug', prettyPrint: false });
//   const cache = new CacheClient(telemetry, { requestTimeout: 0, cachePath: '/var/www/html' });

//   beforeEach(() => {
//     delete process.env.DATABASE_ERROR;
//     vi.clearAllMocks();
//     databaseClient = new PostgreSQLDatabaseClient(telemetry, cache, {
//       protocol: '',
//       host: '',
//       port: null,
//       user: null,
//       password: null,
//       database: '',
//       connectTimeout: 0,
//       connectionLimit: 0,
//       ssl: false,
//     }) as TestDatabase;
//   });

//   test.only('[formatTasks]', () => {
//     expect(databaseClient.formatTasks([{
//       _id: '00000000000000000000001',
//       _runBy: '000000000000000000000002',
//       _startedAt: new Date(),
//       startAfter__id: null,
//       _status: 'PENDING',
//       job__id: '000000000000000000000003',
//       job_requiredSlots: 512,
//       job_maximumExecutionTime: 60,
//       job_scriptPath: '/var/www/html/test.js',
//       metadata: '{}',
//       recurrence: null,
//       startAt: null,
//     }])).toEqual([{
//       _id: new Id('00000000000000000000001'),
//       _runBy: new Id('000000000000000000000002'),
//       _createdAt: new Date(),
//       _startedAt: new Date(),
//       _status: 'PENDING',
//       job: {
//         _id: new Id('000000000000000000000003'),
//         _createdAt: new Date(),
//         requiredSlots: 512,
//         maximumExecutionTime: 60,
//         scriptPath: '/var/www/html/test.js',
//       },
//       metadata: '{}',
//       recurrence: null,
//       startAt: null,
//     }]);
//     expect(databaseClient.formatTasks([{
//       _id: '00000000000000000000001',
//       _runBy: '000000000000000000000002',
//       _startedAt: new Date(),
//       _status: 'PENDING',
//       job__id: '000000000000000000000003',
//       job_requiredSlots: 512,
//       job_maximumExecutionTime: 60,
//       job_scriptPath: '/var/www/html/test.js',
//       metadata: '{}',
//       recurrence: null,
//       startAt: null,
//       startAfter__id: '00000000000000000000004',
//     }])).toEqual([{
//       _id: new Id('00000000000000000000001'),
//       _runBy: new Id('000000000000000000000002'),
//       _createdAt: new Date(),
//       _startedAt: new Date(),
//       _status: 'PENDING',
//       job: {
//         _id: new Id('000000000000000000000003'),
//         _createdAt: new Date(),
//         requiredSlots: 512,
//         maximumExecutionTime: 60,
//         scriptPath: '/var/www/html/test.js',
//       },
//       metadata: '{}',
//       recurrence: null,
//       startAt: null,
//       startAfter: {
//         _id: new Id('00000000000000000000004'),
//         _runBy: new Id('000000000000000000000002'),
//         _createdAt: new Date(),
//         _startedAt: new Date(),
//         _status: 'PENDING',
//         job: new Id('000000000000000000000003'),
//         metadata: '{}',
//         recurrence: null,
//         startAt: null,
//       },
//     }]);
//     expect(databaseClient.formatTasks([{
//       _id: '00000000000000000000001',
//       _runBy: '000000000000000000000002',
//       _status: 'PENDING',
//       _startedAt: new Date(),
//       job__id: '000000000000000000000003',
//       job_requiredSlots: 512,
//       job_maximumExecutionTime: 60,
//       job_scriptPath: '/var/www/html/test.js',
//       metadata: '{}',
//       recurrence: null,
//       startAt: null,
//       startAfter__id: '00000000000000000000004',
//     }])).toEqual([{
//       _id: new Id('00000000000000000000001'),
//       _runBy: new Id('000000000000000000000002'),
//       _createdAt: new Date(),
//       _startedAt: new Date(),
//       _status: 'PENDING',
//       job: {
//         _id: new Id('000000000000000000000003'),
//         _createdAt: new Date(),
//         requiredSlots: 512,
//         maximumExecutionTime: 60,
//         scriptPath: '/var/www/html/test.js',
//       },
//       metadata: '{}',
//       recurrence: null,
//       startAt: null,
//       startAfter: {
//         _id: new Id('00000000000000000000004'),
//         _runBy: null,
//         _createdAt: new Date(),
//         _startedAt: new Date(),
//         _status: 'PENDING',
//         job: new Id('000000000000000000000003'),
//         metadata: '{}',
//         recurrence: null,
//         startAt: null,
//         _parent: new Id('000000000000000000000002'),
//         startAfter: new Id('000000000000000000000005'),
//       },
//     }]);
//     expect(databaseClient.formatTasks([{
//       _id: '00000000000000000000001',
//       _runBy: null,
//       _startedAt: new Date(),
//       _status: 'PENDING',
//       job__id: '000000000000000000000003',
//       job_requiredSlots: 512,
//       job_maximumExecutionTime: 60,
//       job_scriptPath: '/var/www/html/test.js',
//       metadata: '{}',
//       recurrence: null,
//       startAt: null,
//       startAfter__id: '00000000000000000000004',
//     }])).toEqual([{
//       _id: new Id('00000000000000000000001'),
//       _runBy: null,
//       _createdAt: new Date(),
//       _startedAt: new Date(),
//       _status: 'PENDING',
//       job: {
//         _id: new Id('000000000000000000000003'),
//         _createdAt: new Date(),
//         requiredSlots: 512,
//         maximumExecutionTime: 60,
//         scriptPath: '/var/www/html/test.js',
//       },
//       metadata: '{}',
//       recurrence: null,
//       startAt: null,
//       _parent: new Id('000000000000000000000002'),
//       startAfter: new Id('00000000000000000000004'),
//     }]);
//   });

//   describe.only('[updateMatchingTask]', () => {
//     test.only('database error', async () => {
//       process.env.DATABASE_ERROR = 'true';
//       await expect(async () => {
//         await databaseClient.updateMatchingTask({
//           _runBy: null,
//           _id: new Id('000000000000000000000010'),
//         }, { _status: 'CANCELED' });
//       }).rejects.toThrow(new Error('DATABASE_ERROR'));
//       expect((await databaseClient.client.connect()).release).toHaveBeenCalledOnce();
//     });

//     test('no error', async () => {
//       const results = await databaseClient.updateMatchingTask({
//         _runBy: null,
//         _status: 'PENDING',
//         _id: new Id('000000000000000000000010'),
//       }, { _status: 'CANCELED', _runBy: new Id('000000000000000000000001') });
//       expect(results).toBe(true);
//       const query = 'UPDATE "tasks" SET\n  "_status" = $1,\n  "_runBy" = $2\nWHERE\n  "_runBy" IS'
//         + ' NULL\n  AND "_status" = $3\n  AND "_id" = $4;';
//       const log1 = '[PostgreSQLDatabaseClient][updateMatchingTask] Performing the following SQL query on database:';
//       const log2 = `[PostgreSQLDatabaseClient][updateMatchingTask]\n\n${query}\n`;
//       const log3 = '[PostgreSQLDatabaseClient][updateMatchingTask] [\n  CANCELED,\n  000000000000000000000001,\n  PENDING,\n  000000000000000000000010\n]\n';
//       expect(databaseClient.client.connect).toHaveBeenCalledOnce();
//       expect((await databaseClient.client.connect()).query).toHaveBeenCalledOnce();
//       expect((await databaseClient.client.connect()).query).toHaveBeenCalledWith(query, [
//         'CANCELED',
//         '000000000000000000000001',
//         'PENDING',
//         '000000000000000000000010',
//       ]);
//       expect((await databaseClient.client.connect()).release).toHaveBeenCalledOnce();
//       expect(telemetry.debug).toHaveBeenCalledTimes(3);
//       expect(telemetry.debug).toHaveBeenCalledWith(log1);
//       expect(telemetry.debug).toHaveBeenCalledWith(log2);
//       expect(telemetry.debug).toHaveBeenCalledWith(log3);
//     });
//   });

//   test.only('[getRunningTasks]', async () => {
//     vi.spyOn(databaseClient, 'formatTasks').mockImplementation(vi.fn(() => []));
//     const results = await databaseClient.getRunningTasks();
//     expect(results).toEqual([]);
//     const query = 'SELECT\n  "tasks"."_id" AS "_id",\n  "tasks"."_createdAt" AS '
//       + '"_createdAt",\n  "tasks"."_updatedAt" AS "_updatedAt",\n  "tasks"."_runBy" AS "_runBy",'
//       + '\n  "tasks"."_status" AS "_status",\n  "tasks"."_endedAt" AS "_endedAt",\n  '
//       + '"tasks"."_startedAt" AS "_startedAt",\n  "tasks"."_parent" AS "_parent",\n  '
//       + '"tasks"."metadata" AS "metadata",\n  "tasks"."startAt" AS "startAt",\n  '
//       + '"tasks"."recurrence" AS "recurrence",\n  "tasks"."job" AS "job",\n  "tasks"."startAfter"'
//       + ' AS "startAfter",\n  "job"."_id" AS "job__id",\n  "job"."_createdAt" AS "job__createdAt"'
//       + ',\n  "job"."_updatedAt" AS "job__updatedAt",\n  "job"."scriptPath" AS "job_scriptPath",'
//       + '\n  "job"."requiredSlots" AS "job_requiredSlots",\n  "job"."maximumExecutionTime" AS '
//       + '"job_maximumExecutionTime"\nFROM\n  "tasks"\nLEFT JOIN\n  "jobs" AS "job"\nON "tasks"."job" = '
//       + '"job"."_id"\nWHERE\n  "tasks"."_status" = $1;';
//     const log1 = '[PostgreSQLDatabaseClient][getRunningTasks] Performing the following SQL query on database:';
//     const log2 = `[PostgreSQLDatabaseClient][getRunningTasks]\n\n${query}\n`;
//     const log3 = '[PostgreSQLDatabaseClient][getRunningTasks] [\n  IN_PROGRESS\n]\n';
//     expect(telemetry.debug).toHaveBeenCalledTimes(3);
//     expect(telemetry.debug).toHaveBeenCalledWith(log1);
//     expect(telemetry.debug).toHaveBeenCalledWith(log2);
//     expect(telemetry.debug).toHaveBeenCalledWith(log3);
//     expect(databaseClient.client.query).toHaveBeenCalledOnce();
//     expect(databaseClient.client.query).toHaveBeenCalledWith(query, ['IN_PROGRESS']);
//   });

//   test.only('[getCandidatePendingTasks]', async () => {
//     vi.spyOn(databaseClient, 'formatTasks').mockImplementation(vi.fn(() => []));
//     const results = await databaseClient.getCandidatePendingTasks();
//     expect(results).toEqual([]);
//     const query = 'SELECT\n  "tasks"."_id" AS "_id",\n  "tasks"."_createdAt" AS "_createdAt",\n  '
//       + '"tasks"."_updatedAt" AS "_updatedAt",\n  "tasks"."_runBy" AS "_runBy",\n  '
//       + '"tasks"."_status" AS "_status",\n  "tasks"."_endedAt" AS "_endedAt",\n  '
//       + '"tasks"."_startedAt" AS "_startedAt",\n  "tasks"."_parent" AS "_parent",\n  '
//       + '"tasks"."metadata" AS "metadata",\n  "tasks"."startAt" AS "startAt",\n  '
//       + '"tasks"."recurrence" AS "recurrence",\n  "tasks"."job" AS "job",\n  "tasks"."startAfter" '
//       + 'AS "startAfter",\n  "job"."_id" AS "job__id",\n  "job"."_createdAt" AS "job__createdAt",\n'
//       + '  "job"."_updatedAt" AS "job__updatedAt",\n  "job"."scriptPath" AS "job_scriptPath",\n  '
//       + '"job"."requiredSlots" AS "job_requiredSlots",\n  "job"."maximumExecutionTime" AS '
//       + '"job_maximumExecutionTime",\n  "startAfter"."_id" AS "startAfter__id",\n  '
//       + '"startAfter"."_createdAt" AS "startAfter__createdAt",\n  "startAfter"."_updatedAt" AS '
//       + '"startAfter__updatedAt",\n  "startAfter"."_runBy" AS "startAfter__runBy",\n  "startAfter"'
//       + '."_status" AS "startAfter__status",\n  "startAfter"."_startedAt" AS '
//       + '"startAfter__startedAt",\n  "startAfter"."_endedAt" AS "startAfter__endedAt",\n  '
//       + '"startAfter"."_parent" AS "startAfter__parent",\n  "startAfter"."job" AS "startAfter_job",'
//       + '\n  "startAfter"."metadata" AS "startAfter_metadata",\n  "startAfter"."startAt" AS '
//       + '"startAfter_startAt",\n  "startAfter"."recurrence" AS "startAfter_recurrence",\n  '
//       + '"startAfter"."startAfter" AS "startAfter_startAfter"\nFROM\n  "tasks"\nLEFT JOIN\n  '
//       + '"tasks" AS "startAfter"\nON "tasks"."startAfter" = "startAfter"."_id"\nLEFT JOIN\n  "jobs"'
//       + ' AS "job"\nON "tasks"."job" = "job"."_id"\nWHERE\n  "tasks"."_status" = $1\n  AND ("tasks".'
//       + '"startAt" <= $2 OR "startAfter"."_status" = $3);';
//     const log1 = '[PostgreSQLDatabaseClient][getCandidatePendingTasks] Performing the following SQL query on database:';
//     const log2 = `[PostgreSQLDatabaseClient][getCandidatePendingTasks]\n\n${query}\n`;
//     const log3 = '[PostgreSQLDatabaseClient][getCandidatePendingTasks] [\n  PENDING,\n  Sat Jan 01 2022 00:00:00 GMT+0000 (Coordinated Universal Time),\n  COMPLETED\n]\n';
//     expect(telemetry.debug).toHaveBeenCalledTimes(3);
//     expect(telemetry.debug).toHaveBeenCalledWith(log1);
//     expect(telemetry.debug).toHaveBeenCalledWith(log2);
//     expect(telemetry.debug).toHaveBeenCalledWith(log3);
//     expect(databaseClient.client.query).toHaveBeenCalledOnce();
//     expect(databaseClient.client.query).toHaveBeenCalledWith(query, [
//       'PENDING',
//       new Date(),
//       'COMPLETED',
//     ]);
//   });
// });
