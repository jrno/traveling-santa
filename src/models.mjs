import { distanceBetweenPoints } from "./utils.mjs";

/**
 * Representation of a route from base to base containing an array 
 * of points to cover
 */
export class Route {
  constructor(points, weight, distance) {
    this.points = points; 
    this.weight = weight;
    this.coveredDistance = this.points[0].distanceFromBase + distance + this.points[this.points.length-1].distanceFromBase;
  }
  getPointIds() {
    return this.points.map(point => point.id);  
  }
  getTotalDistance() {
    return this.coveredDistance;
  }
  hasDuplicates() {
    const pointIds = this.points.map(p => p.id);
    return new Set(pointIds).size !== pointIds.length;
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
  sortPathsByDistance(searchDepth=2) {
    this.paths = this.paths.sort((a,b) => a.distance > b.distance ? 1 : -1);
    const nearByPlaces = Math.min(this.paths.filter(p => p.distance <= 1000).length, 3);
    this.paths = this.paths.splice(0, Math.max(nearByPlaces, searchDepth));
  }
  getPaths() {
    return this.paths;
  }
  getGiftWeight() {
    return this.giftWeight;
  }
}