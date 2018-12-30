import cluster from 'cluster';
import os from 'os';
import redis from 'redis';

import { run } from './main.mjs';
import { runWorker } from './worker.mjs';

const redisClient = redis.createClient(); 

// Target: ~700K-800K 
// #1 Baseline / 1000 : 3.7M km 
// #2 Next iteration / 1000: 3.1M km (re-wrote generate routes function)
// #3 Next iteration / 1000: 2.3M km (included three paths instead of two for distances under 1000km) 32s local
// #4 Next iteration / 1000: 1.8M km (conditional starting and branch sizes depending on the progress)
// #5 Next iteration / 1000: 1.5M km (optimize graph after trip)

/////////

/**
 * FILE_NAME: Input data filename, in the working dir.
 * MAX_ENTRIES: How many records to slice from input file, undefined for no slicing
 * GRAPH_DEPTH: Determines how many connections each point has to adjacent points (nearest)
 * MAX_ITEMS_FOR_WORKER: Determines the batch size sent for each worker
 * NUM_WORKERS: Worker processes to fork
 */

const config = {  
  FILE_NAME: 'nicelist.txt',
  MAX_ENTRIES: 1000,
  GRAPH_CONNECTIONS: 25,
  MAX_ITEMS_FOR_WORKER: 5,
  NUM_WORKERS: os.cpus().length
}

const startMaster = function() {

  console.log(`starting to solve santa's traveling problem ${JSON.stringify(config, undefined, 2)}`);

  let workers = [];
  let workersPrepared = 0

  redisClient.flushdb((err) => {
    if (!err) {
      console.log("in-memory cache cleared");
    }
  });

  // Each worker takes a while to initialize. Wait until all workers are initialized
  cluster.on('message', (worker, msg) => {
    if (msg.type === 'PREPARED') {
      workersPrepared += 1;
    }
  });

  for (let i = 0; i < config.NUM_WORKERS; ++i) {
    workers.push(cluster.fork());
  }

  const waitWorkersToBoot = () => {
    setTimeout(() => {
      if (workersPrepared < workers.length) {
        console.log(`${workers.length - workersPrepared} workers still not initialized`);
        waitWorkersToBoot();
      } else {
        run(workers, config);
      }
    }, 1000);
  };

  waitWorkersToBoot();
}

const startWorker = function() {
  runWorker(redisClient, config);
}

/// 

if (cluster.isMaster) {
  startMaster();
} else {
  startWorker();
}