import fs from 'fs'
import deg2rad from 'deg2rad'
import zlib from 'zlib'
import { createPoint } from './models.mjs';

export const intersection = (first, second) => first.filter(id => second.indexOf(id) !== -1);

/**
 * Reads the input file as an array of Points
 */
export const readPointsFromFile = (filename, maxEntries = undefined) => {
  // TODO: Store to redis and read from redis in workers.
  const file = fs.readFileSync(filename);
  const uncompressed = zlib.gunzipSync(file).toString();
  const points = uncompressed.split("\n").map((line) => {
    const cols = line.split(";");
    return createPoint(cols[0], cols[1], cols[2], cols[3]);
  });

  return maxEntries ? points.splice(0, maxEntries) : points;
}

/**
 * Write arrays as csv
 */
export const writeCsv = (fileName, data, callback, separator = ';', linebreak = '\n') => {
  const csv = data.map(row => row.join(separator)).join(linebreak);
  fs.writeFile(`./solutions/${fileName}`, csv, (err) => {
    if (err) {
      callback(err);
    }
    callback();
  });
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
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // distance in km
  return d;
}

/**
 * Sort two routes by amount of points (primary) and by lowest distance (secondary) 
 */
export const sortRoutes = (a, b) => {
  return a.score < b.score ? 1 : -1;
}