import cluster from 'cluster';
import { readPointsFromFile, fillConnections } from './utils.mjs';
import { createRoute } from './models.mjs';
import { sortRoutes } from './utils.mjs';

const MAX_WEIGHT_IN_GRAMS = 10000000; // max weight of single gift run as grams
const MAX_PATHS_FOR_POINT = 5; // scale up for better results

export const runWorker = (fileName, maxEntries) => {

  console.log(`Worker ${process.pid} started`);
  const pointsRaw = readPointsFromFile(fileName).slice(0, maxEntries);
  const pointsWithConnections = fillConnections(pointsRaw, MAX_PATHS_FOR_POINT);

  process.on('message', (msg) => {

    const pointsCompleted = new Set(msg.pointsIdsCompleted);
    const pointsToProcess = pointsWithConnections.filter(p => msg.pointIds.includes(p.id.toString()));
    const bestRoute = pointsToProcess
      .map(point => findBestRoute(point, [], 0, point.distanceFromBase, pointsCompleted, msg.branchSize))
      .sort(sortRoutes)[0];

    process.send({
      workerId: msg.workerId,
      type: 'DATA',
      pointIds: msg.pointIds,
      bestRoute: bestRoute
    });
  });

  process.send({
    id: cluster.worker.id,
    type: 'PREPARED',
  });
}

const sortPathsByDistance = (paths, totalWeight) => {
  return paths.sort((a,b) => a.distance > b.distance ? 1 : -1)
}

const sortPathsByContinuationsAndDistance = (paths, totalWeight) => {
  return paths.sort((a,b) => {
    const aContinuations = a.point.paths
    .map(nextPath => nextPath.point.giftWeight)
    .filter(giftWeight => (a.point.giftWeight + giftWeight + totalWeight) < MAX_WEIGHT_IN_GRAMS).length;
    const aPoints = (1000 - a.distance) + (aContinuations * 75) // TODO: Just negate ?
    const bContinuations = b.point.paths
    .map(nextPath => nextPath.point.giftWeight)
    .filter(giftWeight => (b.point.giftWeight + giftWeight + totalWeight) < MAX_WEIGHT_IN_GRAMS).length;
    const bPoints = (1000 - b.distance) + (bContinuations * 75)
    return aPoints < bPoints ? 1 : -1;
  });
}

const findBestRoute = (point, routePointIds, totalWeight, totalDistance, ignoreIds, branchSize) => {
  
  // Copy route state
  const route = routePointIds.slice(0);
  route.push(point.id);

  // TODO: Optimize this check by pre-processing node information before calculation with ignoreIds
  const possiblePaths = point.paths.filter((path) => isViablePath(path, ignoreIds, routePointIds, totalWeight))

  // Terminate when no more options to pursue. Note that distance back to base is added to combined route distance
  if (possiblePaths.length === 0) {
    return createRoute(route, totalWeight, totalDistance + point.distanceFromBase)
  }

  // Descend to next nodes
  const prioritizedPaths = sortPathsByDistance(possiblePaths, totalWeight);
  const nextPaths = (prioritizedPaths.length > branchSize) ? prioritizedPaths.slice(0, branchSize) : prioritizedPaths;
  return nextPaths.map(path => {
    return findBestRoute(
      path.point,
      route,
      totalWeight + point.giftWeight,
      totalDistance + path.distance,
      ignoreIds,
      (Math.max(3, branchSize) - 1)
    );
  }).sort(sortRoutes)[0];
}

/**
 * Function to return true if given path is viable alternative in route planning, false
 * if path cannot be used.
 * 
 * @param path - path object (with distance and point)
 * @param idsVisited - set of point ids that are already processed
 * @param idsInRoute - array of point ids already en route
 * @param routeWeight - current route weight
 */
const isViablePath = (path, idsVisited, idsInRoute, routeWeight) => {
  return routeWeight + path.point.giftWeight <= MAX_WEIGHT_IN_GRAMS &&
         !idsVisited.has(path.point.id) && 
         !idsInRoute.includes(path.point.id) 
}
