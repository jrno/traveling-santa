import { Route, Point } from './models.mjs';
import { readPointsFromFile, distanceBetweenPoints } from './utils.mjs';
import { writeCsv } from './utils.mjs';

const MAX_WEIGHT_IN_GRAMS = 10000000; // Max weight of single gift run as grams

// Target: ~700K-800K 
//
// #1 Baseline / 1000 : 3.7M km 
// #2 Next iteration / 1000: 3.1M km (re-wrote generate routes function)
// #3 Next iteration / 1000: 2.3M km (included three paths instead of two for distances under 1000km) 32s local
// #4 Next iteration / 1000: 1.8M km (conditional starting and branch sizes depending on the progress)
// 
// Ideas:
// - Can we use already computed paths or have faster access in route gen?
// - Check how to optimize javascript code
//
// Todos:
//
// - Smarter branching in plan route. Not only by distance, but by next options considered to current weight
// - Test & check optimization of planRoute, e.g remove the slice
// - Fork process per / core for plan route => allows to use more options
// - Parameterize all that affects the algorithm. Easier combination testing

/**
 * Fill points with connections to one another (=paths). Function will calculate 
 * distance between points and create paths from one point to another
 * 
 * @param points - all points
 * @param maxNearestConnections - how many connections to nearest points to create
 */
const fillConnections = (points, maxNearestConnections) => {

  for (const point of points) {
    
    console.log(`processing point data for ${point.id}`);

    for (const nextPoint of points) {
      if (point.id !== nextPoint.id) {
        const distance = distanceBetweenPoints(point.lat,point.lon,nextPoint.lat,nextPoint.lon);
        point.addPath(nextPoint, distance);
      }
    }

    // Sort by distance, nearest first. Leave connections to X nearest nodes only.
    point.paths = point.paths.sort((a,b) => a.distance > b.distance ? 1 : -1);
    point.paths = point.paths.slice(0, maxNearestConnections);
  }

  return points;
}

/**
 * Function to return true if given path is viable alternative in route planning, false
 * if path cannot be used.
 * 
 * @param path - path object (with distance and point)
 * @param idsVisited - set of point ids that are already processed
 * @param idsInRoute - set of point ids already en route
 * @param routeWeight - current route weight
 */
const isViablePath = (path, idsVisited, idsInRoute, routeWeight) => {
  return !idsVisited.has(path.point.id) && 
         !idsInRoute.has(path.point.id) && 
         routeWeight + path.point.giftWeight <= MAX_WEIGHT_IN_GRAMS 
}

/**
 * Recursive function to generate possible routes from given point
 * 
 * @param point - current point 
 * @param myPoints - previous points in route
 * @param totalWeight - combined weight in route
 * @param totalDistance  - combined distance in route
 * @param ignoreIds - point id's that should be ignored
 * @param results - result array
 * @param branches - number indicating how many branches to make, larger number indicates more permutations
 */
const generateRoutesFromPoint = (point, myPoints, totalWeight, totalDistance, ignoreIds, results, branches = 2) => {
  
  // required to check that we won't back track.
  const routePointIds = new Set(myPoints.map(point => point.id));

  // copy route data and add current point.
  const myPointsCopy = myPoints.slice(0);
  myPointsCopy.push(point);

  // returns true if paths point is not processed, within current route and weight limit is ok
  const viablePaths = point.paths.filter((path) => isViablePath(path, ignoreIds, routePointIds, totalWeight))
  // TODO: smarter selection of paths to pursue from viable paths
  const paths = (viablePaths.length > branches) ? viablePaths.slice(0, branches) : viablePaths;

  // terminate route if no options to continue
  if (paths.length === 0) {
    results.push(new Route(myPointsCopy, totalWeight, totalDistance));
    return;
  }

  // TODO: Instead of the forEach and count distance use createRoutes(nextViablePaths.map(p => p.point))
  // Would it be possible to return route instead of pushing it to a result array.
  for (const path of paths) {
    generateRoutesFromPoint(
      path.point, 
      myPointsCopy,
      totalWeight + point.giftWeight, 
      totalDistance + path.distance, 
      ignoreIds, 
      results);
  }
}

/**
 * Generate all routes for given points
 * 
 * @param points - array of {Point} instances to start from
 * @param completed - array of point id's that should be skipped
 * @param branchSize - allowed branch size
 */
const planRoute = (points, completed, branchSize) => {
  let results = [];
  for (const point of points) {
    let routes = [];
    generateRoutesFromPoint(point, [], 0, 0, completed, routes, branchSize);
    results = results.concat(routes);
  }
  // sort by criteria and pick best alternative
  results = results.sort(sortByPointsAndDistance);
  return results[0];
}

const sortByPointsAndDistance = (a, b) => {
  if (a.points.length === b.points.length) {
    return a.getTotalDistance() > b.getTotalDistance() ? 1 : -1;
  }
  return a.points.length < b.points.length ? 1 : -1;
}

const run = (fileName, maxEntries, maxConnectionsFromPoint) => {

  const pointsRaw = readPointsFromFile(fileName).slice(0, maxEntries);
  const pointsWithConnections = fillConnections(pointsRaw, maxConnectionsFromPoint);
  const pointsCompleted = new Set();
  const results = [];

  let totalDistance = 0;
  let totalTrips = 0;

  while (pointsCompleted.size < pointsWithConnections.length) {

    const currentProgress = pointsCompleted.size / pointsWithConnections.length;
    const nextBranchSize = currentProgress > 0.8 ? 4 : currentProgress > 0.5 ? 3 : 2; // 6/4/3 real
    const nextStartingPointCount = 20;  // 100/30/15 real. 0.42s on 10, 2:20 on 20 per 1000 entries.
    const nextStartingPoints = pointsWithConnections.filter(p => !pointsCompleted.has(p.id)).slice(0, nextStartingPointCount);
    
    // TODO: parallel execution of route computation with 4 workers
    console.time("planRoute");
    const plan = planRoute(nextStartingPoints, pointsCompleted, nextBranchSize);
    console.timeEnd("planRoute");

    const planPointIds = plan.getPointIds();
    planPointIds.forEach(id => pointsCompleted.add(id));
    results.push(planPointIds);
  
    totalDistance += plan.getTotalDistance();;
    totalTrips += 1;
  
    console.log(`${pointsWithConnections.length - pointsCompleted.size} unhappy children remaining. Breadth: ${nextBranchSize}, Batch: ${nextStartingPoints.length}, Children: ${planPointIds}`);
  }

  console.log(`Visited ${pointsCompleted.size} children in ${totalTrips} trips covering ${totalDistance * 1000} meters`);
  writeCsv(`${maxEntries}-${totalTrips}-${totalDistance}.csv`, results);
}

/////////

console.time('run')
run(
  'nicelist.txt', 
  1000,   // amount of entries to use from input file
  6       // amount of connections to make from point to point (nearest first) 
);
console.timeEnd('run');








