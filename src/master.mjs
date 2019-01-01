
import { default as util } from './utils.mjs';
import * as R from 'ramda';
import fs from 'fs';
import delay from 'delay';

// import 'fs/promises' as fsp.. some weirdness with that using es6 modules
const { promises: fsp } = fs; 

let tripId = 0;  
let tripLength = undefined;
let tripInProgress = false;
let tripRemainingPoints = undefined;
let tripQueuedPoints = undefined;
let tripResults = []; 
let tripData = [];
let workerStatus = undefined;
let completedPointIds = [];
let distance = 0;

/**
 * Validate results against original point data. Helps to ensure that 
 * no bugs exist in algorithm code (duplicate points etc. in final result)
 * 
 * @returns true if no errors were found and false otherwise
 */
const validate = (pointIds, results) => {

  const occurences = R.countBy(Math.floor)([].concat(...results));
  if (Object.keys(occurences).length !== pointIds.length || Object.values(occurences).filter(val => val !== 1).length > 0) {
      console.error(occurences);
      return false;
  }

  return true;
}

/**
 * Handle batch result message from worker. Writes current progress to stdout and appends state.
 */
const handleWorkerResult = (msg) => {

  if (msg.type === 'DATA') {

    workerStatus[msg.workerId] = 'IDLE';
    tripResults.push(msg.bestRoute);
    tripRemainingPoints = tripRemainingPoints.filter(pointId => !msg.pointIds.includes(pointId));
    
    // progress bar
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`${Math.floor(((tripLength - tripRemainingPoints.length) / tripLength) * 100)}%`)

    // trip is completed, choose the best route from worker selections
    if (tripInProgress && tripRemainingPoints.length === 0) {

      tripInProgress = false;
      process.stdout.clearLine();
      process.stdout.cursorTo(0);

      tripResults.sort(util.sortRoutes);
      const bestRoute = tripResults[0];
      tripResults = [];

      completedPointIds = completedPointIds.concat(bestRoute.points);
      tripData.push(bestRoute.points);
      distance += bestRoute.distance;     

      console.log(`#${tripId}. Distance: ${distance}. ${completedPointIds.length} resolved. [${bestRoute.points}]`);
    }
  }
}

/**
 * Main branch. Solves the problem using provided config and workers
 * 
 * @param workers - array of workers started with cluster.fork()
 * @param config - global config object
 */
const run = async (workers, config) => {

  console.log(`master started (pid #${process.pid})`);
  
  const allPoints = util.readPointsFromFile(config.FILE_NAME).slice(0, config.MAX_ENTRIES);
  const allPointIds = allPoints.map(p => p.id);
  const filterNotIn = (a, b) => a.filter(pointId => !b.includes(pointId));  

  workers.forEach((worker) => worker.on('message', handleWorkerResult));
  workerStatus = workers.map(() => 'IDLE'); // array index corresponds to 'workers' index.

  // eslint-disable-next-line no-constant-condition
  while (true) {
    
    // assign more work to idle workers in current trip planning
    if (tripInProgress) {

      if (workerStatus.includes('IDLE') && tripQueuedPoints.length > 0) {
        for (let i = 0; i < workers.length; ++i) {
          if (workerStatus[i] === 'IDLE') {

            const work = [];
            for (let d = Math.min(config.MAX_ITEMS_FOR_WORKER, tripQueuedPoints.length); d > 0; --d) {
              work.push(tripQueuedPoints.shift());
            }
      
            if (work.length > 0) {
              workerStatus[i] = 'BUSY';
              workers[i].send({
                tripId: tripId,
                tripData: tripData,
                workerId: i,
                pointIds: work,
              });
            }
          }
        }
      }

      // trip is completed, start a new trip.
    } else if (completedPointIds.length < allPointIds.length) {
      
      tripId += 1;
      tripRemainingPoints = filterNotIn(allPointIds, completedPointIds);
      tripLength = tripRemainingPoints.length;
      tripQueuedPoints = tripRemainingPoints.slice(0); 
      tripInProgress = true;

    } else {

      // all trips are planned, tear down workers and write the result csv
      workers.forEach(worker => worker.kill());
      if (validate(allPointIds, tripData)) {
        console.log(`Visited ${completedPointIds.length} children in ${tripId} trips covering ${distance} kilometers`);
        await fsp.writeFile(`./solutions/${allPoints.length}-${tripId}-${distance}.csv`, tripData.map(r => r.join(";")).join("\n"));
        process.exit(0);
      } else {
        console.error("result was not valid, check algorithm");
        process.exit(1);
      }
    }
    
    await delay(100);
  }
}

export default run;