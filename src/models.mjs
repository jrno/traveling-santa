import { distanceBetweenPoints } from "./utils.mjs";

/**
 * Representation of a route from base to base containing an array 
 * of points to cover
 */
export class Route {
  constructor(points, weight, distance) {
    this.points = points; 
    this.weight = weight;
    this.distance = distance; 
  }
  getPointIds() {
    return this.points.map(point => point.id);  
  }
  getTotalDistance() {
    return this.points[0].distanceFromBase + 
           this.distance + 
           this.points[this.points.length-1].distanceFromBase;
  }
  toString() {
    return this.points.map(p => p.id).join(",");
  }
}

export class Point {
  constructor(id, lat, lon, giftWeight) {
    this.id = new Number(id);
    this.lat = new Number(lat);
    this.lon = new Number(lon);
    this.giftWeight = new Number(giftWeight);
    this.paths = [];
    this.distanceFromBase = distanceBetweenPoints(
      this.lat,
      this.lon,
      68.073611, 
      29.315278
    );
  }
  addPath(point, distance) {
    this.paths.push({
      distance: distance,
      point: point  
    })  
  }
}