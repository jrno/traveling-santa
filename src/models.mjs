import { distanceBetweenPoints } from "./utils.mjs";

export const createRoute = (pointIds, weight, distance) => {
  return {
    points: pointIds,
    weight: weight,
    distance: new Number(distance),
    distanceToPointRatio: distance / pointIds.length
  }
}

export const createPoint = (id, lat, lon, giftWeight) => {
  return {
    id: id,
    lat: new Number(lat),
    lon: new Number(lon),
    giftWeight: new Number(giftWeight),
    distanceFromBase: distanceBetweenPoints(lat, lon, 68.073611, 29.315278),
    paths: [],
  }
}

export const addPath = (fromPoint, toPoint, distance) => {
  fromPoint.paths.push({
    distance: distance,
    point: toPoint
  });
}