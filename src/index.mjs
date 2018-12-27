import cluster from 'cluster';
import os from 'os';
import { run } from './main.mjs';
import { runWorker } from './worker.mjs';

// TODO:
// - Check ideas.md
// - Better algorithm to choose best route. Try to optimize for minimum remaining total distance.
// - Use dynamic batch size and initial breadth. Lower breadth on each recursive call
// - Shuffle starting points on each batch or atleast include best 10 from last run? now re-runs same points over and over again
// - Optimize recursive code
// - Cache already solved routes, somehow.

// Target: ~700K-800K 
// #1 Baseline / 1000 : 3.7M km 
// #2 Next iteration / 1000: 3.1M km (re-wrote generate routes function)
// #3 Next iteration / 1000: 2.3M km (included three paths instead of two for distances under 1000km) 32s local
// #4 Next iteration / 1000: 1.8M km (conditional starting and branch sizes depending on the progress)

/////////

const FILE_NAME = 'nicelist.txt';
const MAX_ENTRIES = 1000;
const NUM_CPUS = os.cpus().length - 2;

const startMaster = function() {

  let workers = [];
  let workersPrepared = 0

  // Each worker takes a while to initialize. Wait until all workers are initialized
  cluster.on('message', (worker, msg) => {
    if (msg.type === 'PREPARED') {
      workersPrepared += 1;
    }
  });

  for (let i = 0; i < NUM_CPUS; ++i) {
    workers.push(cluster.fork());
  }

  const waitWorkersToBoot = () => {
    setTimeout(() => {
      if (workersPrepared < workers.length) {
        console.log("Still waiting for all workers to initialize");
        waitWorkersToBoot();
      } else {
        console.log("All workers prepared. Starting solver");
        run(workers, FILE_NAME, MAX_ENTRIES);
      }
    }, 1000);
  };

  waitWorkersToBoot();
}

const startWorker = function() {
  runWorker(FILE_NAME, MAX_ENTRIES);
}

/// 

if (cluster.isMaster) {
  startMaster();
} else {
  startWorker();
}