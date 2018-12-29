import cluster from 'cluster';
import os from 'os';
import redis from 'redis';

import { run } from './main.mjs';
import { runWorker } from './worker.mjs';

// TODO:
//
// - Test optimizing against smallest absolute distance remaining instead of smallest distance/point ratio in route
//
// - Optimize graph after each trip in workers. Re-create 3-4 smallest paths based on prev select.
//
// - Use selectBestPointDistance for 50% and selectMostPoints after 50% (?) 
//
// - Determine starting points with an algorithm. Don't just shuffle, but choose the ones with largest spread in lat/lon. This 
//   Will minimize overlapping route combinations
// 
// - Dynamic adjustment of graph connections after each trip instead of completedIds
// 
// - Clean up code and split main.mjs to functions, values to global scope. See examples on how to bind properly 
//   from https://github.com/lvx3/cluster-cache/blob/master/cluster-node-cache.js
// 
// - Check ideas.md
// - Better algorithm to choose best route. Try to optimize for minimum remaining total distance.

// Target: ~700K-800K 
// #1 Baseline / 1000 : 3.7M km 
// #2 Next iteration / 1000: 3.1M km (re-wrote generate routes function)
// #3 Next iteration / 1000: 2.3M km (included three paths instead of two for distances under 1000km) 32s local
// #4 Next iteration / 1000: 1.8M km (conditional starting and branch sizes depending on the progress)

/////////

const redisClient = redis.createClient(); 

const config = {  
  FILE_NAME: 'nicelist.txt',
  MAX_ENTRIES: 1000,
  MAX_POINTS_FOR_TRIP: 150,
  MAX_PATHS_FOR_POINT: 3,
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
        console.log("Still waiting for all workers to initialize");
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