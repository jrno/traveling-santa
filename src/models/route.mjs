/**
 * Simple representation of a route.
 * 
 * Route has an array of points, a weight and covered distance. 
 * Score is pre-calculated for faster sort using inverted distance to point ratio
 * 
 * Route with lowest distance/point ratio has the highest score
 */
const createRoute = (pointIds, weight, distance) => {
  return {
    points: pointIds,
    weight: weight,
    distance: new Number(distance),
    score: (100000 - (distance / pointIds.length))
  }
}

export default createRoute;
