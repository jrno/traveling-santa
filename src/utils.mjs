import fs from 'fs'
import deg2rad from 'deg2rad'
import zlib from 'zlib'
import {Point} from './models';

/**
 * Reads the input file as an array of Points
 */
export const readPointsFromFile = (filename, maxEntries = undefined) => {
  const file = fs.readFileSync(filename);
  const uncompressed = zlib.gunzipSync(file).toString();
  const points = uncompressed.split("\n").map((line) => {
    const cols = line.split(";");
    return new Point(cols[0], cols[1], cols[2], cols[3]);
  });

  return maxEntries ? points.splice(0, maxEntries) : points;
}

/**
 * Returns the distance between two points (as kilometers)
 * 
 * @param R - Radius of the earth as kilometers
 */
export const distanceBetweenPoints = (lat1,lon1,lat2,lon2,R = 6378) => {
  const dLat = deg2rad(lat2 - lat1); 
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // distance in km
  return d;
}