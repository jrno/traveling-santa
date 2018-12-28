import { readPointsFromFile, writeCsv } from './utils.mjs';
import { sortRoutes } from './utils.mjs';

/**
 * Find best route 
 * 
 * @param workers - array of workers (initialized with cluster.fork())
 * @param fileName - filename to use as input
 * @param maxEntries - amount of records to slice from input
 */
export const run = (workers, fileName, maxEntries) => {

  const handleMessage = (msg) => {

    if (msg.type === 'DATA') {

      workerStatus[msg.workerId] = 'IDLE';
      tripResults.push(msg.bestRoute);
      
      // modify processed points
      tripRemainingPoints = tripRemainingPoints.filter(pointId => !msg.pointIds.includes(pointId));
      process.stdout.write(`${Math.floor(((allPointIds.length - tripRemainingPoints.length) / allPointIds.length) * 100)}%.. `)

      if (tripInProgress && tripRemainingPoints.length === 0) {

        tripInProgress = false;
        tripResults.sort(sortRoutes);
        const selectedRoute = tripResults[0];
        const planPointIds = selectedRoute.points;

        totalCompletedPointIds = totalCompletedPointIds.concat(planPointIds);
        totalResults.push(planPointIds);
        totalDistance += selectedRoute.distance;
        totalTrips += 1;      

        console.log("");
        console.log(`Trip planner completed. Distance: ${totalDistance} & ${allPointIds.length - totalCompletedPointIds.length} remaining. Trip: ${planPointIds}`);
        tripResults = [];
      }
    }
  };

  workers.forEach((worker) => worker.on('message', handleMessage));

  const allPointIds = readPointsFromFile(fileName).slice(0, maxEntries).map(p => p.id);
  const workerStatus = workers.map(() => 'IDLE');

  let tripInProgress = false;
  let tripRemainingPoints = undefined; 
  let tripQueuedPoints = undefined; 
  let tripResults = [];
  let tripId = 0;

  let totalCompletedPointIds = [];
  let totalResults = [];
  let totalDistance = 0;
  let totalTrips = 0;

  const nextAction = function() {
    setTimeout(() => {

      if (!tripInProgress) {

        // Assign new batch or complete 
        if (totalCompletedPointIds.length < allPointIds.length) {
          
          tripId += 1;
          tripRemainingPoints = allPointIds.filter(id => !totalCompletedPointIds.includes(id));
          tripQueuedPoints = tripRemainingPoints.slice(0); // copy
          tripInProgress = true;
          console.log(`Trip planner started. Points remaining: ${tripRemainingPoints.length}`);
          nextAction();

        } else {

          workers.forEach(worker => worker.kill());
          console.log(`Visited ${totalCompletedPointIds.length} children in ${totalTrips} trips covering ${totalDistance * 1000} meters`);
          writeCsv(`${maxEntries}-${totalTrips}-${totalDistance}.csv`, totalResults, () => {
            process.exit();
          });
        }

      } else {

        // Issue more work to current batch
        if (workerStatus.includes('IDLE') && tripQueuedPoints.length > 0) {

          for (let i = 0; i < workers.length; ++i) {

            if (workerStatus[i] === 'IDLE') {

              const batchWork = [];
              for (let d = Math.min(20, tripQueuedPoints.length); d > 0; --d) {
                batchWork.push(tripQueuedPoints.shift());
              }

              if (batchWork.length > 0) {
                workerStatus[i] = 'BUSY';
                workers[i].send({
                  tripId: tripId,
                  workerId: i,
                  pointIds: batchWork,
                  pointsIdsCompleted: totalCompletedPointIds
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