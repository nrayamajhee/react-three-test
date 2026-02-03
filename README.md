# React router project with react-three-fiber

Vibe coded Icosphere with LOD and displacement map.

## 🛠 Tech Stack

- **[Three.js](https://threejs.org/)** & **[React Three Fiber](https://docs.pmnd.rs/react-three-fiber)**: Providing the underlying WebGL abstractions and React integration.
- **[React Three Drei](https://github.com/pmndrs/drei)**: Utilized for its robust library of functional helpers.
- **[React Router](https://reactrouter.com/)**: Managing the application state and view transitions with framework-level precision.
- **[Vite](https://vitejs.dev/)**: The backbone of our development cycle, ensuring rapid HMR and optimized production builds.
- **[Leva](https://github.com/pmndrs/leva)**: Integrated for real-time parameter orchestration and debugging.

## 🌍 The Planet Geometry Algorithm

The challenge of rendering a planet lies in managing complexity at scale. This project addresses that through a multi-stage geometric pipeline:

### 1. The Icosahedral Foundation

We begin with a unit **Icosahedron**. As a Platonic solid with 20 equilateral faces, it provides the most uniform distribution of vertices for a spherical projection, minimizing the distortion found in standard UV spheres.

### 2. Topological Displacement (Height Maps)

To move beyond a perfect sphere, we sample height data $H(v)$—sourced from procedural noise or textures—using the normalized vertex vector as a spherical coordinate.
$$V_{final} = V_{unit} \times (Radius + H(V_{unit}) \times ElevationScale)$$
Post-displacement, normals are recalculated to ensure that lighting accurately reflects the new terrain.

### 3. Intelligence in Detail (Dynamic LOD)

Density is not applied uniformly. The algorithm evaluates "targets" to decide where triangles are most needed:

- **Proximity**: Higher resolution is allocated based on the camera's distance, using a non-linear decay $\gamma$ to preserve detail where it matters most.
- **Feature Density**: Latitude-based or height-based biases allow for specialized detail in polar or mountainous regions.
- **Quantization**: LOD levels are stepped to prevent "mesh popping" and to allow for efficient vertex caching.

### 4. Geometric Synthesis (Pseudocode)

The vertex generation logic focuses on maintaining a seamless manifold while transitioning between subdivision levels:

```javascript
function generateGeometry(v1, v2, v3, edgeResolutions, centerResolution) {
  // Determine the maximum required density for this patch
  const maxK = Math.max(...Object.values(edgeResolutions), centerResolution);
  const vertices = [];
  const indices = [];

  // 1. Barycentric Grid Generation
  // We use Slerp (Spherical Linear Interpolation) to maintain
  // equidistant placement on the sphere's surface.
  for (let i = 0; i <= maxK; i++) {
    for (let j = 0; j <= maxK - i; j++) {
      const k = maxK - i - j;
      let pos = slerp3Way(v1, v2, v3, i / maxK, j / maxK, k / maxK);

      // 2. Seam Management (Snap-to-Grid)
      // Boundary vertices are snapped to the neighbor's resolution
      // to eliminate T-junctions and visible cracks.
      if (isBoundary(i, j, k, maxK)) {
        pos = snapToEdgeResolution(pos, i, j, k, edgeResolutions);
      }

      vertices.push(pos);
    }
  }

  // 3. Manifold Indexing
  // Triangles are generated while filtering out degenerate (zero-area)
  // faces created during the snapping phase.
  return { vertices, indices: generateIndices(maxK, vertices) };
}
```

### 5. Finalization & Optimization

Each icosahedral face undergoes a **Hierarchical Subdivision**. We first split the face into a base grid, then process each sub-triangle individually. Final vertices are deduplicated via a precision-weighted hash map, and normals are computed for smooth, realistic shading.

## Credits

The Earth topography and bathymetry data used in these maps are sourced from NASA's Blue Marble: Next Generation project.

**Source:** [NASA Earth Observatory - Blue Marble: Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/#topography)

**Original Data Credit:**
The topography and bathymetry were derived from the General Bathymetric Chart of the Oceans (GEBCO) produced by the British Oceanographic Data Centre (BODC).

These images were combined and processed for use in this project.

Source available. All rights reserved.

In the era of stolen knowledge and exploited labor, I am not sure if this claim of copyright even makes any sense. I paid in tokens to product them, so I shall lay claim.

