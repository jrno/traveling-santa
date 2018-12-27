import cluster from 'cluster';
import { readPointsFromFile, sortRoutes, fillConnections } from './utils.mjs';
import { createRoute } from './models.mjs';

const MAX_WEIGHT_IN_GRAMS = 10000000; // Max weight of single gift run as grams

export const runWorker = (fileName, maxEntries) => {

  console.log(`Worker ${process.pid} started`);
  const pointsRaw = readPointsFromFile(fileName).slice(0, maxEntries);
  const pointsWithConnections = fillConnections(pointsRaw, 7);

  process.on('message', (msg) => {

    const pointsCompleted = new Set(msg.pointsIdsCompleted);
    const pointsToProcess = pointsWithConnections.filter(p => msg.pointIds.includes(p.id.toString()));
    const branchSize = msg.branchSize;

    let results = [];
    for (const point of pointsToProcess) {
      let routes = [];
      findRoutes(point, [], 0, point.distanceFromBase, pointsCompleted, routes, branchSize);
      routes.sort(sortRoutes);
      results = results.concat(routes[0]);
    } 

    results.sort(sortRoutes);

    process.send({
      workerId: msg.workerId,
      type: 'DATA',
      pointIds: msg.pointIds,
      bestRoute: results[0]
    });
  });

  process.send({
    id: cluster.worker.id,
    type: 'PREPARED',
  });
}

const sortPathsByDistance = (paths, totalWeight, maxWeight) => {
  return paths.sort((a,b) => a.distance > b.distance ? 1 : -1)
}

const sortPathsByContinuationsAndDistance = (paths, totalWeight, maxWeight) => {
  return paths.sort((a,b) => {
    const aContinuations = a.point.paths
    .map(nextPath => nextPath.point.giftWeight)
    .filter(giftWeight => (a.point.giftWeight + giftWeight + totalWeight) < maxWeight).length;
    const aPoints = (1000 - a.distance) + (aContinuations * 75) // TODO: Just negate ?
    const bContinuations = b.point.paths
    .map(nextPath => nextPath.point.giftWeight)
    .filter(giftWeight => (b.point.giftWeight + giftWeight + totalWeight) < MAX_WEIGHT_IN_GRAMS).length;
    const bPoints = (1000 - b.distance) + (bContinuations * 75)
    return aPoints < bPoints ? 1 : -1;
  });
}

/**
 * Recursive function to generate possible routes from given point
 * 
 * @param point - current point 
 * @param myPointIds - previous points in route
 * @param totalWeight - combined weight in route
 * @param totalDistance  - combined distance in route
 * @param ignoreIds - point id's that should be ignored
 * @param results - result array
 * @param branchSize - number indicating how many branches to make, larger number indicates more permutations
 */
const findRoutes = (point, myPointIds, totalWeight, totalDistance, ignoreIds, results, branchSize) => {

  // Recursive function requires copying current route state in each branch
  const route = myPointIds.slice(0);
  route.push(point.id);

  // Determine what branches to pursue in route generation. We can't follow all due combinatorial explosion.
  const possiblePaths = point.paths.filter((path) => isViablePath(path, ignoreIds, myPointIds, totalWeight))
  const prioritizedPaths = sortPathsByDistance(possiblePaths, totalWeight, MAX_WEIGHT_IN_GRAMS);
  const nextPaths = (prioritizedPaths.length > branchSize) ? prioritizedPaths.slice(0, branchSize) : prioritizedPaths;
  
  // Terminate when no more options to pursue. Note that distance back to base is added to combined route distance
  if (nextPaths.length === 0) {
    results.push(createRoute(route, totalWeight, totalDistance + point.distanceFromBase));
    return;
  }

  // TODO: Instead of the forEach and count distance use createRoutes(nextViablePaths.map(p => p.point))
  // Would it be possible to return route instead of pushing it to a result array.
  for (const path of nextPaths) {
    findRoutes(
      path.point, 
      route,
      totalWeight + point.giftWeight, 
      totalDistance + path.distance, 
      ignoreIds, 
      results, 
      Math.max(3, branchSize) - 1);
  }
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
  return !idsVisited.has(path.point.id) && 
         !idsInRoute.includes(path.point.id) && 
         routeWeight + path.point.giftWeight <= MAX_WEIGHT_IN_GRAMS 
}
