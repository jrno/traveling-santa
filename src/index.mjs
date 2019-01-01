import cluster from 'cluster';
import os from 'os';
import redis from 'redis';
import delay from 'delay';

import { default as master } from './master.mjs';
import { default as worker } from './worker.mjs';

const redisClient = redis.createClient(); 

/**
 * FILE_NAME: input data filename, file needs to be in project root.
 * MAX_ENTRIES: x records to slice from input file. use 'undefined' for full solution
 * GRAPH_DEPTH: x nearest nodes to map when building the graph
 * MAX_ITEMS_FOR_WORKER: max nodes to send for a worker to process at once
 * NUM_WORKERS: amount of workers
 */

const config = {  
  FILE_NAME: 'nicelist.txt',
  MAX_ENTRIES: 1000, 
  GRAPH_CONNECTIONS: 30,
  MAX_ITEMS_FOR_WORKER: 10,
  NUM_WORKERS: os.cpus().length
}

/**
 * Starts the solver by forking required workers, clearing local cache and starting the master in
 * current process 
 */
const start = async () => {

  console.log(`application started: ${JSON.stringify(config, undefined, 2)}`);

  let workers = [];
  let workersPrepared = 0

  const listenForWorkerPrepared = (_worker, msg) => {
    if (msg.type === 'PREPARED') {
      workersPrepared += 1;
    }
  }

  redisClient.flushdb((err) => (!err) 
    ? console.log("redis cache cleared") 
    : console.error('problem clearing redis'));

  cluster.on('message', listenForWorkerPrepared);

  [...Array(config.NUM_WORKERS)].forEach(() => workers.push(cluster.fork()));

  // each worker prepares point data individually. it takes a while..
  while (workersPrepared < config.NUM_WORKERS) {
    await delay(1000);
  }

  cluster.removeListener('message', listenForWorkerPrepared);
  master(workers, config);
}

if (cluster.isMaster) {
  start();
} else {
  worker(redisClient, config);
}