// /**
//  * Copyright (c) Openizr. All Rights Reserved.
//  *
//  * This source code is licensed under the MIT license found in the
//  * LICENSE file in the root directory of this source tree.
//  *
//  */

// import { Stream } from 'stream';
// import Logger from 'scripts/services/Logger';
// import BucketClient from 'scripts/services/BucketClient';

// describe('services/BucketClient', () => {
//   vi.mock('stream');
//   vi.mock('scripts/services/Logger');
//   vi.spyOn(console, 'warn').mockImplementation(() => null);
//   const { warn } = console;

//   beforeEach(() => {
//     vi.clearAllMocks();
//   });

//   test('uploadLogs', async () => {
//     const logger = new Logger({ logLevel: 'info', prettyPrint: false });
//     const bucketClient = new BucketClient(logger);
//     bucketClient.upload('application/pdf', '/var/log/test.pdf', new Stream());
//     expect(warn).toHaveBeenCalledWith('Bucket client: "uploadLogs" method is not implemented
//  - skipping upload of file {"mimeType":"application/pdf","name":"test.pdf","path":"/var/log/tes
// t.pdf"}...');
//   });
// });
