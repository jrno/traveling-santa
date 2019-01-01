import { default as util } from '../utils.mjs';

/**
 * Simple representation of a point (or a node) in graph.
 * 
 * Point is a child with weight gift and coordinates. 
 * For each point absolute distance from base point (=korvatunturi) is calculated.
 */
const createPoint = (id, lat, lon, giftWeight) => {
  return {
    id: id,
    lat: new Number(lat),
    lon: new Number(lon),
    giftWeight: new Number(giftWeight),
    distanceFromBase: util.distanceBetweenPoints(lat, lon, 68.073611, 29.315278),
    paths: []  
  }
}

export default createPoint;
