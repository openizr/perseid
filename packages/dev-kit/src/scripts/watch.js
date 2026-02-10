import chokidar from 'chokidar';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const syncFiles = async () => {
  try {
    await execAsync('rsync -av src/ dist/ --exclude=__playground__');
    console.log('Files synced successfully');
  } catch (error) {
    console.error('Error syncing files:', error);
  }
};

// Initialize dist directory
execAsync('rm -rf dist && mkdir dist && cp LICENSE README.md package.json dist/')
  .then(() => {
    console.log('Initial setup completed');
    // Start watching for changes
    const watcher = chokidar.watch('src/**/*', {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true
    });

    watcher
      .on('add', syncFiles)
      .on('change', syncFiles)
      .on('unlink', syncFiles);

    console.log('Watching for file changes...');
  })
  .catch(error => {
    console.error('Error during initial setup:', error);
  });