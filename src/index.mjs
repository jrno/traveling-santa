import { Route, Point } from './models.mjs';
import { readPointsFromFile, distanceBetweenPoints } from './utils.mjs';

const MAX_WEIGHT_IN_GRAMS = 10000000; // Max weight of single gift run as grams
const MAX_PATHS_PER_POINT = 6; // Amount of connections to make from point to other points

// TODO: Can we use already computed paths or have faster access in route gen?
// TODO: Parallel execution of route generation allows to bump up parameters
// TODO: Check general best practices for performance
// - minimize function object allocation
// - minimize object size

// Tasks:
// - Paranna reittien luonnin suorituskykyä a) tehostamalla koodia ja b) poistamalla turhia vaihtoehtoja
// - Tutki breadth size hommaa, aikaisemmin oli vain eka taso 3:lla ja loput defaultannut kahdeksi.

/**
 * For provided points fill possible paths with distances and distance from base camp
 * 
 * @param points 
 */
const processPointData = (points) => {

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
    point.paths = point.paths.slice(0, MAX_PATHS_PER_POINT);
  }

  return points;
}

/**
 * Returns true if given path should be pursued in route generation
 * 
 * @param path - path containing distance and point object
 * @param idsVisited - set of point ids that are already processed
 * @param idsInRoute - set of point id's already en route
 * @param routeWeight - current route weight
 */
const isViablePath = (path, idsVisited, idsInRoute, routeWeight) => {
  return !idsVisited.has(path.point.id) && 
         !idsInRoute.has(path.point.id) && 
         routeWeight + path.point.giftWeight <= MAX_WEIGHT_IN_GRAMS 
}

/**
 * Generate array of Routes starting from given point.
 * 
 * @param point - current point 
 * @param myPoints - all the points in route
 * @param totalWeight - combined weight of the current route
 * @param totalDistance  - combined distance covered in current route
 * @param ignoreIds - point id's to not pursue
 * @param results - result array holds all routes
 * @param branches - allowed paths to branch from single point
 */
const generateRoutesFromPoint = (point, myPoints, totalWeight, totalDistance, ignoreIds, results, branches = 2) => {
  
  // required to check that we won't back track.
  const routePointIds = new Set(myPoints.map(point => point.id));

  // copy route data and add current point.
  const myPointsCopy = myPoints.slice(0);
  myPointsCopy.push(point);

  // returns true if paths point is not processed, within current route and weight limit is ok
  const viablePaths = point.paths.filter((path) => isViablePath(path, ignoreIds, routePointIds, totalWeight))
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
const getNextRoute = (points, completed, branchSize) => {
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

/**
 * Returns the next points to start from when creating possible routes
 * 
 * @param allPoints - array of points (all data)
 * @param processed  - array of point id's that are already processed
 * @param max - max elements to return
 */
const nextStartingPoints = (allPoints, processed, max) => {
  return allPoints.filter(p => !processed.has(p.id)).slice(0, max);
}

const sortByPointsAndDistance = (a, b) => {
  if (a.points.length === b.points.length) {
    return a.getTotalDistance() > b.getTotalDistance() ? 1 : -1;
  }
  return a.points.length < b.points.length ? 1 : -1;
}

// Target: ~700K-800K 
//
// #1 Baseline / 1000 : 3.7M km 
// #2 Next iteration / 1000: 3.1M km (re-wrote generate routes function)
// #3 Next iteration / 1000: 2.3M km (included three paths instead of two for distances under 1000km) 32s local
// #4 Next iteration / 1000: 1.8M km (conditional starting and branch sizes depending on the progress)

// TODO: Important
// - Best choice for starting point set & scaling of elements?
// - Best choice of depth size to pursue depending on the complexity of the route.

const points = readPointsFromFile('nicelist.txt').splice(0, 1000); 
const allPoints = processPointData(points);

const completed = new Set();
const finalCsv = [];
let finalDistance = 0;
let giftRuns = 0;

while (completed.size < allPoints.length) {

  const progress = completed.size / allPoints.length;
  const routeBranchSize = progress > 0.8 ? 4 : progress > 0.5 ? 3 : 2; // 6/4/3 real
  const routeStartingPoints = progress > 0.6 ? 25 : progress > 0.3 ? 5 : 2;  // 100/30/15 real
  const startingPoints = nextStartingPoints(allPoints, completed, routeStartingPoints);
  // TODO: parallel execution of route computation with 4 workers
  const nextRoute = getNextRoute(startingPoints, completed, routeBranchSize);
  const coveredPointIds = nextRoute.getPointIds();
  const coveredDistance = nextRoute.getTotalDistance();

  coveredPointIds.forEach(id => completed.add(id));
  finalCsv.push(coveredPointIds);
  finalDistance += coveredDistance;
  giftRuns += 1;

  console.log(`${allPoints.length - completed.size} unhappy children remaining. Breadth: ${routeBranchSize}, Batch: ${startingPoints.length}, Distance: ${coveredDistance}, Children: ${coveredPointIds}`);
}

// TODO: Write csv
console.log(`Visited ${completed.size} children in ${giftRuns} trips covering ${finalDistance * 1000} meters`);
