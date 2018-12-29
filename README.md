# traveling-santa

https://traveling-santa.reaktor.com

## TODO

- Refactor pointsWithConnections as Graph class.
- Optimize Graph after each trip planning by checking when the tripId is changed and using the last data to swipe 
  Optimize local graph in worker. Optimization includes removing all nodes that were selected from paths 
  And using much larger initial path count.


TODO: re-write graph method to return new paths as sorted. check if results are still the same. might be some bug?
