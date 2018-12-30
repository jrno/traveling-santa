import cluster from 'cluster';
import { promisify } from 'util';
import { readPointsFromFile, intersection } from './utils.mjs';
import { Graph } from './graph';
import { createRoute } from './models.mjs';
import { sortRoutes as sortRoutesBy } from './utils.mjs';

const MAX_WEIGHT_IN_GRAMS = 10000000; // max weight of single gift run as grams

export const runWorker = (redisClient, config) => {

  console.log(`new worker process started. PID: ${process.pid}`);

  // to be used with async/await
  const cacheGet = promisify(redisClient.get).bind(redisClient);
  const cacheSet = promisify(redisClient.set).bind(redisClient);
  const cacheRemove = promisify(redisClient.del).bind(redisClient);

  const points = readPointsFromFile(config.FILE_NAME).slice(0, config.MAX_ENTRIES);
  const graph = new Graph(points, config.GRAPH_CONNECTIONS);
  let tripId = undefined;

  process.on('message', async (msg) => {

    const tripData = msg.tripData;
    const tripDataPoints = [].concat(...tripData);

    if (msg.tripId !== tripId && tripData && tripData.length > 0) {
      graph.arrange(tripData[tripData.length-1], tripDataPoints);
    }

    const pointsToProcess = graph.getPoints(msg.pointIds);
    const results = [];
    
    for (const point of pointsToProcess) {

      const routeStr = await cacheGet(point.id);
      let bestRoute = undefined;

      if (routeStr != null) {
        const route = JSON.parse(routeStr); // TODO: Weight is string after unwrap
        if (intersection(route.points, tripDataPoints).length > 0) {
          await cacheRemove(point.id);
        } else {
          bestRoute = route;
        }
      }
      
      if (bestRoute === undefined) {
        bestRoute = findBestRoute(point, [], new Set(), 0, point.distanceFromBase, sortRoutesBy);
        await cacheSet(point.id, JSON.stringify(bestRoute));
      }

      results.push(bestRoute);
    }

    results.sort(sortRoutesBy);    
    process.send({
      workerId: msg.workerId,
      type: 'DATA',
      pointIds: msg.pointIds,
      bestRoute: results[0] // pick the best of all
    });
  });

  process.send({
    id: cluster.worker.id,
    type: 'PREPARED',
  });
}

const findBestRoute = (point, routePointIds, routePointBag, previousWeight, previousDistance, sortFunction, depth = 0) => {
  // TODO: Slice only if necessary before branching
  
  // Copy route state
  const currentWeight = previousWeight + point.giftWeight;
  const route = routePointIds.slice(0);
  route.push(point.id);
  routePointBag.add(point.id);

  // Determine what paths can be pursued. 
  // If no viable options remain we'll end the route as recursions trivial case.
  const possiblePaths = point.paths.filter((p) => isViablePath(p.point, routePointBag, currentWeight));
  
  if (possiblePaths.length === 0) {
    return createRoute(route, previousWeight, previousDistance + point.distanceFromBase)
  }

  return possiblePaths.map(path => {
    return findBestRoute(
      path.point,
      route,
      routePointBag,
      currentWeight,
      previousDistance + path.distance,
      sortFunction,
      depth+1,
    );
  }).sort(sortFunction)[0];
}

/**
 * Function to return true if given path is viable alternative in route planning, false
 * if path cannot be used.
 * 
 * @param path - path object (with distance and point)
 * @param idsInRoute - array of point ids already en route
 * @param routeWeight - current route weight
 */
const isViablePath = (nextPoint, prevIds, routeWeight) => {
  return !prevIds.has(nextPoint.id) && 
         (routeWeight + nextPoint.giftWeight) <= MAX_WEIGHT_IN_GRAMS
}
