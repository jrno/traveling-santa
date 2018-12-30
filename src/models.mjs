import { distanceBetweenPoints } from "./utils.mjs";

const primaryByDistancePointRatio = (pointIds, weight, distance) => 0 - distance / pointIds.length;
export const createRoute = (pointIds, weight, distance) => {
  return {
    points: pointIds,
    weight: weight,
    distance: new Number(distance),
    score: primaryByDistancePointRatio(pointIds, weight, distance)
  }
}

export const createPoint = (id, lat, lon, giftWeight) => {
  return {
    id: id,
    lat: new Number(lat),
    lon: new Number(lon),
    giftWeight: new Number(giftWeight),
    distanceFromBase: distanceBetweenPoints(lat, lon, 68.073611, 29.315278),
    paths: []  
  }
}