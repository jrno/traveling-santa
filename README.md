# traveling-santa

https://traveling-santa.reaktor.com

## TODO

- Implement and analyze the effect of tail branching. Create two path versions for each point, x3 and x4. After
a certain depth in the path use the extended branch. What about at very small depth? How does it affect

- Implement point adjacency matrix. Each point should map other points within 100km,200km,300km,400km,500km etc. When ranking a route score, a route which picks most adjacent points would win. 100km = 10p, 200km = 9p, 300km = 8p etc.

- Optimize worker startup by unzipping and reading the file data to redis. and reading it from there

- Optimize the round startup time by improving the farthest x nodes search
