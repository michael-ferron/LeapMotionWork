import json
import sys
import numpy as np
from mpl_toolkits.mplot3d import Axes3D
import matplotlib.pyplot as pl


filename = sys.argv[1]

with open(filename, "r") as f:
    data = json.load(f)

normal = [x['palmNormal'] for x in data]
palmPosition = [y['stabilizedPalmPosition'] for y in data]
#print normal
#print palmPosition

fig = pl.figure()
axes = fig.add_subplot(121, projection='3d')
xs1 = []
ys1 = []
zs1 = []
for s in range(len(normal)):
	xset = normal[s][0]
	xs1.append(xset)
	yset = normal[s][1]
	ys1.append(yset)
	zset = normal[s][2]
	zs1.append(zset)
	axes.scatter(xset, yset, zset, c='r', marker='o')
	
axes.plot(xs1, ys1, zs1,c='b')

axes.set_xlabel('X')
axes.set_ylabel('Y')
axes.set_zlabel('Z')

ax = fig.add_subplot(122, projection='3d')
xs2 = []
ys2 = []
zs2 = []
for s in range(len(palmPosition)):
	xset = palmPosition[s][0]
	xs2.append(xset)
	yset = palmPosition[s][1]
	ys2.append(yset)
	zset = palmPosition[s][2]
	zs2.append(zset)
	ax.scatter(xset, yset, zset, c='r', marker='o')
	
ax.plot(xs2, ys2, zs2,c='b')

ax.set_xlabel('X')
ax.set_ylabel('Y')
ax.set_zlabel('Z')

pl.show()