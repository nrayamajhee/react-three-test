# Planet Geometry Algorithm (Condensed Pseudocode)

### 1. Initial State
- Start with a unit **Icosahedron** (12 vertices, 20 faces).
- All vertices are normalized vectors (Length = 1).

### 2. Level of Detail (LOD) Function
- Define `getResolution(vertex)`:
    - Map vertical height (`y`: -1 to 1) to a linear `0..1` range.
    - Apply `pow(height, gamma)` for non-linear bias.
    - Interpolate between `minResolution` and `maxResolution` across $N$ discrete steps.

### 3. Hierarchical Subdivision
For each of the 20 icosahedron faces:
1. **Base Grid**: Subdivide the face into a fixed base grid (e.g., $5 \times 5$).
2. **Sub-Face Processing**: For every triangle in the base grid:
    - Calculate required resolution ($K$) for the face center and its three edges ($E1, E2, E3$) using the LOD function.
    - Set internal subdivision density to $K_{max} = \max(Center, E1, E2, E3)$.
    - Generate a local $(i, j)$ vertex grid for this sub-face.

### 4. Vertex Generation & Stitching
For each local sub-face grid:
- **Interpolation**: Use **Slerp** (Spherical Linear Interpolation) to place vertices.
- **Seam Stitching**: 
    - If a vertex lies on an edge, snap its position to the resolution of that specific edge ($K_{edge}$).
    - Multiple high-density internal vertices will "fan" into the same boundary vertex of a lower-density neighbor.
- **Deduplication**: Use a hash map (precision-rounded coordinates) to ensure shared vertices across faces/sub-faces are unique.

### 5. Face Indexing
- Iterate through the local grids.
- Generate two triangles per grid cell.
- **Constraint**: Discard "degenerate" triangles (where two or more indices are identical) created by the snapping/stitching process.

### 6. Finalization
- Scale all final vertices by `Radius`.
- Compute normals for smooth shading.
