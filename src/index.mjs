import { Route, Point } from './models.mjs';
import { readPointsFromFile, distanceBetweenPoints } from './utils.mjs';

const MAX_WEIGHT_IN_GRAMS = 10000000; // 10.000kg
const MAX_DISTANCE_FOR_PATH = 3000;

// TODO: Refactor algorithm for choosing what paths to create to processPointData function
// TODO: Make more path connections on near-proximity targets
// TODO: Instead of passing the exclude list re-process nodes and remove path connections that are obsolete

/**
 * For provided points fill possible paths with distances and distance from base camp
 * 
 * @param points 
 * @param searchDepth 
 */
const processPointData = (points) => {
  points.forEach((point, i) => {
    console.log(`processing point data ${i}`);
    points.forEach(nextPoint => {
      if (point.id !== nextPoint.id) {
        const pathDistance = distanceBetweenPoints(point.lat,point.lon,nextPoint.lat,nextPoint.lon);
        if (pathDistance < MAX_DISTANCE_FOR_PATH) {
          point.addPath(nextPoint, pathDistance);
        }
      }
    });
    point.sortPathsByDistance();
  });
  // points that are closest to base are first. 
  return points.sort((a,b) => a.distanceFromBase > b.distanceFromBase ? 1 : -1);
}

const createRoutes = (nodes, route, totalWeight, totalDistance, excludes, results) => {
  
  nodes.forEach((node) => {

    // add node to route
    const currentRoute = route.slice(0);
    currentRoute.push(node);

    // check next node paths
    const pathIsNotProcessed = (path) => !excludes.has(path.point.id);
    const pathIsNotInRoute = (path) => !route.map(point => point.id).includes(path.point.id);
    const pathWeightIsSufficient = (path) => (totalWeight + path.point.getGiftWeight() <= MAX_WEIGHT_IN_GRAMS);

    const nextViablePaths = node.paths
      .filter(pathIsNotProcessed)
      .filter(pathIsNotInRoute)
      .filter(pathWeightIsSufficient);

    // terminate route if no options to continue
    if (nextViablePaths.length === 0) {
      results.push(new Route(currentRoute, totalWeight, totalDistance));
      return;
    }

    // TODO: Instead of the forEach and count distance use createRoutes(nextViablePaths.map(p => p.point))
    // Would it be possible to return route instead of pushing it to a result array.
    nextViablePaths.forEach(path => createRoutes(
      [path.point], 
      currentRoute, 
      totalWeight + node.getGiftWeight(), 
      totalDistance + path.distance, 
      excludes, 
      results));
  });
}

// Target: ~700K-800K 
//
// #1 Baseline / 1000 : 3.7M km 
// #2 Next iteration / 1000: 3.1M km (re-wrote generate routes function)
// #3 Next iteration / 1000: 2.3M km (included three paths instead of two for distances under 1000km) 32s local
// #4 Next iteration / 1000: Optimize code and make use of multiple cores

const points = readPointsFromFile('nicelist.txt').splice(0); 
const pointsWithPaths = processPointData(points);
const donePoints = new Set();
const finalCsv = [];
let finalDistance = 0;
let giftRuns = 0;

// results is an array of array of points
while (donePoints.size < pointsWithPaths.length) {

  const searchPoints = pointsWithPaths.filter(p => !donePoints.has(p.id));
  
  let routes = []
  createRoutes(searchPoints, [], 0, 0, donePoints, routes);
  routes.sort((a,b) => a.points.length < b.points.length ? 1 : -1);

  const route = routes[0];
  const pointIds = route.getPointIds();

  pointIds.forEach(id => donePoints.add(id));
  finalCsv.push(pointIds);
  finalDistance += route.coveredDistance;
  giftRuns += 1;

  console.log(`Covered ${route.coveredDistance} km & children: ${pointIds}`);
}

// TODO: Write csv
console.log(`Visited ${donePoints.size} children in ${giftRuns} routes covering ${finalDistance} km`);
