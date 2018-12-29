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
  const graph = new Graph(points, config.GRAPH_DEPTH); // TODO: from config
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
        const route = unstringifyRoute(routeStr); // TODO: Weight is string after unwrap
        if (intersection(route.points, tripDataPoints).length > 0) {
          await cacheRemove(point.id);
        } else {
          bestRoute = route;
        }
      }
      
      if (bestRoute === undefined) {
        bestRoute = findBestRoute(point, [], 0, point.distanceFromBase, sortRoutesBy);
        await cacheSet(point.id, stringifyRoute(bestRoute));
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

const stringifyRoute = (route) => route.points.join("-") + '|' + route.weight + '|' + route.distance;

const unstringifyRoute = (str) => {
  const fields = str.split('|');
  return createRoute(fields[0].split('-'), fields[1], fields[2]);
}

const findBestRoute = (point, routePointIds, totalWeight, totalDistance, sortFunction) => {
  
  // Copy route state
  const route = routePointIds.slice(0);
  route.push(point.id);

  // TODO: Optimize this check by pre-processing node information before calculation with ignoreIds
  const possiblePaths = point.paths.filter((path) => isViablePath(path, routePointIds, totalWeight))

  // Terminate when no more options to pursue. Note that distance back to base is added to combined route distance
  if (possiblePaths.length === 0) {
    return createRoute(route, totalWeight, totalDistance + point.distanceFromBase)
  }

  // Descend to next nodes
  return possiblePaths.map(path => {
    return findBestRoute(
      path.point,
      route,
      totalWeight + point.giftWeight,
      totalDistance + path.distance
    );
  }).sort(sortFunction)[0];
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
const isViablePath = (path, idsInRoute, routeWeight) => {
  return !idsInRoute.includes(path.point.id) && 
         routeWeight + path.point.giftWeight <= MAX_WEIGHT_IN_GRAMS
}
