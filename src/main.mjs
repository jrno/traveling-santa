import { readPointsFromFile, chooseBestRoute, writeCsv, shuffle } from './utils.mjs';

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
      process.stdout.write(`${Math.floor(((tripStartingPointCount - tripRemainingPoints.length) / tripStartingPointCount) * 100)}%.. `)

      if (tripInProgress && tripRemainingPoints.length === 0) {

        tripInProgress = false;
        const selectedRoute = chooseBestRoute(tripResults);
        const planPointIds = selectedRoute.points;

        totalCompletedPointIds = totalCompletedPointIds.concat(planPointIds);
        totalResults.push(planPointIds);
        totalDistance += selectedRoute.distance;
        totalTrips += 1;      

        console.log("");
        console.log(`Trip planner completed. ${allPointIds.length - totalCompletedPointIds.length} remaining. Trip: ${planPointIds}`);
        tripResults = [];
      }
    }
  };

  workers.forEach((worker) => worker.on('message', handleMessage));

  const allPointIds = readPointsFromFile(fileName).slice(0, maxEntries).map(p => p.id);
  const workerStatus = workers.map(() => 'IDLE');

  let tripInProgress = false;
  let tripProgressRatio = 0.0;
  let tripStartingPointCount = 30;
  let tripRemainingPoints = undefined; 
  let tripQueuedPoints = undefined; 
  let tripInitialBranchSize = undefined;
  let tripResults = [];

  let totalCompletedPointIds = [];
  let totalResults = [];
  let totalDistance = 0;
  let totalTrips = 0;

  const nextAction = function() {
    setTimeout(() => {

      if (!tripInProgress) {

        // Assign new batch or complete 
        if (totalCompletedPointIds.length < allPointIds.length) {

          tripProgressRatio = totalCompletedPointIds.length / allPointIds.length;
          tripInitialBranchSize = tripProgressRatio > 0.8 ? 6 : tripProgressRatio > 0.6 ? 5 : tripProgressRatio > 0.4 ? 4 : 3;
          tripStartingPointCount = tripProgressRatio > 0.8 ? 300 : tripProgressRatio > 0.6 ? 200 : tripProgressRatio > 0.4 ? 100 : 50;

          tripRemainingPoints = shuffle(allPointIds.filter(id => !totalCompletedPointIds.includes(id)).slice(0, tripStartingPointCount))
          tripQueuedPoints = tripRemainingPoints.slice(0); // copy
          tripInProgress = true;
          console.log(`Trip planner started. Initial branch size: ${tripInitialBranchSize}. Points: ${tripRemainingPoints.length}`);
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
              for (let d = Math.min(5, tripQueuedPoints.length); d > 0; --d) {
                batchWork.push(tripQueuedPoints.shift());
              }

              if (batchWork.length > 0) {
                workerStatus[i] = 'BUSY';
                workers[i].send({
                  workerId: i,
                  pointIds: batchWork,
                  pointsIdsCompleted: totalCompletedPointIds,
                  branchSize: tripInitialBranchSize
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