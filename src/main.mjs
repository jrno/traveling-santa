import { readPointsFromFile, writeCsv } from './utils.mjs';
import { sortRoutes } from './utils.mjs';
import * as R from 'ramda';

/**
 * Validate results against original point data. Helps to ensure that 
 * no bugs exist in algorithm code (duplicate points etc. in final result)
 * 
 * @returns true if no errors were found and false otherwise
 */
const validate = (pointIds, results) => {

  const pointOccurrences = R.countBy(Math.floor)([].concat(...results));
  if (Object.keys(pointOccurrences).length !== pointIds.length || 
      Object.values(pointOccurrences).filter(val => val !== 1).length > 0) {
      console.error(pointOccurrences);
      return false;
  }
  
  return true;
}

/**
 * Main branch. Solves the problem using provided config and workers
 * 
 * @param workers - array of workers started with cluster.fork()
 * @param config - global config object
 */
export const run = (workers, config) => {

  const handleMessage = (msg) => {

    if (msg.type === 'DATA') {

      workerStatus[msg.workerId] = 'IDLE';
      tripResults.push(msg.bestRoute);
      tripRemainingPoints = tripRemainingPoints.filter(pointId => !msg.pointIds.includes(pointId));
      
      // update current progress
      const progress = Math.floor(((tripLength - tripRemainingPoints.length) / tripLength) * 100);
      if (progress > 0) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
      } 
      process.stdout.write(`${progress}%`)
      
      if (tripInProgress && tripRemainingPoints.length === 0) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        tripResults.sort(sortRoutes);
        const selectedRoute = tripResults[0];
        const tripPointIds = selectedRoute.points;

        totalCompletedPointIds = totalCompletedPointIds.concat(tripPointIds);
        tripData.push(tripPointIds);
        totalDistance += selectedRoute.distance;     

        console.log(`#${tripId}. Distance: ${totalDistance}. ${(allPointIds.length - totalCompletedPointIds.length)} remains. [${tripPointIds}]`);
        tripResults = [];
        tripInProgress = false;
      }
    }
  };

  workers.forEach((worker) => worker.on('message', handleMessage));

  const allPoints = readPointsFromFile(config.FILE_NAME).slice(0, config.MAX_ENTRIES);
  const allPointIds = allPoints.map(p => p.id);
  const workerStatus = workers.map(() => 'IDLE');

  let tripId = 0;  
  let tripLength = undefined;
  let tripInProgress = false;
  let tripRemainingPoints = undefined; 
  let tripQueuedPoints = undefined; 
  let tripResults = [];
  let tripData = [];
  let totalCompletedPointIds = [];
  let totalDistance = 0;

  const nextAction = function() {
    setTimeout(() => {

      if (!tripInProgress) {

        // Assign new batch or complete 
        if (totalCompletedPointIds.length < allPointIds.length) {
          
          tripId += 1;
          tripRemainingPoints = allPoints.filter(point => !totalCompletedPointIds.includes(point.id)).map(point => point.id);
          tripLength = tripRemainingPoints.length;
          tripQueuedPoints = tripRemainingPoints.slice(0); 
          tripInProgress = true;
          nextAction();

        } else {

          workers.forEach(worker => worker.kill());
          console.log(`Visited ${totalCompletedPointIds.length} children in ${tripId} trips covering ${totalDistance * 1000} meters`);
          if (validate(allPointIds, tripData)) {
            writeCsv(`${allPoints.length}-${tripId}-${totalDistance}.csv`, tripData, () => {
              process.exit();
            });
          } else {
            console.error("result was not valid, check algorithm");
            process.exit(1);
          }
        }

      } else {

        // Issue more work to current batch
        if (workerStatus.includes('IDLE') && tripQueuedPoints.length > 0) {

          for (let i = 0; i < workers.length; ++i) {

            if (workerStatus[i] === 'IDLE') {

              const batchWork = [];
              for (let d = Math.min(config.MAX_ITEMS_FOR_WORKER, tripQueuedPoints.length); d > 0; --d) {
                batchWork.push(tripQueuedPoints.shift());
              }

              if (batchWork.length > 0) {
                workerStatus[i] = 'BUSY';
                workers[i].send({
                  tripId: tripId,
                  tripData: tripData,
                  workerId: i,
                  pointIds: batchWork,
                });
              }
            }
          }
        }

        nextAction();
      }

    }, 100)
  };

  nextAction(); 
}