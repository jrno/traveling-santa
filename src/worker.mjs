import { promisify } from 'util';
import Graph from './models/graph';
import createRoute from './models/route.mjs';
import { default as util } from './utils.mjs';

const MAX_WEIGHT_IN_GRAMS = 10000000; // max weight of single gift run as grams

let cacheGet = undefined;
let cacheSet = undefined;
let cacheRemove = undefined;
let tripId = undefined;
let graph = undefined;

const run = (redisClient, config) => {

  console.log(`worker started (pid #${process.pid})`);
  const points = util.readPointsFromFile(config.FILE_NAME).slice(0, config.MAX_ENTRIES);

  cacheGet = promisify(redisClient.get).bind(redisClient);
  cacheSet = promisify(redisClient.set).bind(redisClient);
  cacheRemove = promisify(redisClient.del).bind(redisClient);
  graph = new Graph(points, config.GRAPH_CONNECTIONS);
  process.on('message', handleWorkAssignment);

  // notify master that worker is ready
  process.send({
    id: process.pid, 
    type: 'PREPARED', 
  });
}

/**
 * Handle work assignment from master and find the best route from given points
 */
const handleWorkAssignment = async (msg) => {

  // collect all already completed nodes
  const tripData = msg.tripData;
  const tripDataPoints = [].concat(...tripData);

  // optimize local graph by removing completed nodes
  if (msg.tripId !== tripId && tripData && tripData.length > 0) {
      graph.arrange(tripData[tripData.length-1], tripDataPoints);
  }

  const pointsToProcess = graph.getPoints(msg.pointIds);
  const results = [];

  // from given points find the winner, use cache to avoid unnecessary re-computation
  for (const point of pointsToProcess) {

    const routeStr = await cacheGet(point.id);
    let bestRoute = undefined;

    if (routeStr != null) {
      const route = JSON.parse(routeStr);
      if (util.intersection(route.points, tripDataPoints).length > 0) {
        await cacheRemove(point.id);
      } else {
        bestRoute = route;
      }
    }
    
    if (bestRoute === undefined) {
      bestRoute = findBestRoute(point, [], new Set(), 0, point.distanceFromBase, util.sortRoutesBy);
      await cacheSet(point.id, JSON.stringify(bestRoute));
    }

    results.push(bestRoute);
  }

  // send winner back to master
  process.send({
    workerId: msg.workerId,
    type: 'DATA',
    pointIds: msg.pointIds,
    bestRoute: results.sort(util.sortRoutesBy)[0] 
  });
}

/**
 * Recursive function to find best route starting from given point using the provided sort function
 * 
 * @param point - starting point
 * @param routeIds - array of point ids en route
 * @param routeIdsSet - set of point ids en route (faster lookup than array)
 * @param previousWeight - route weight 
 * @param previousDistance - route distance
 * @param sort - fn used for picking the best route
 */
const findBestRoute = (point, routeIds, routeIdsSet, previousWeight, previousDistance, sort) => {

  // copy state
  const currentWeight = previousWeight + point.giftWeight;
  const route = routeIds.slice(0);
  route.push(point.id);
  routeIdsSet.add(point.id);

  // check next possible paths. If no paths remain we've arrived to trivial case
  const possiblePaths = point.paths.filter((p) => isViablePath(p.point, routeIdsSet, currentWeight));
  if (possiblePaths.length === 0) {
    return createRoute(route, previousWeight, previousDistance + point.distanceFromBase)
  }

  return possiblePaths.map(path => {
    return findBestRoute(
      path.point,
      route,
      routeIdsSet,
      currentWeight,
      previousDistance + path.distance,
      sort
    );
  }).sort(sort)[0];
}

/**
 * Returns true if next point is viable (won't exceed weight limit or has been seen)
 */
const isViablePath = (nextPoint, prevIds, routeWeight) => {
  return !prevIds.has(nextPoint.id) && (routeWeight + nextPoint.giftWeight) <= MAX_WEIGHT_IN_GRAMS
}

export default run;