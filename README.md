# React router project with react-three-fiber

Vibe coded Icosphere with LOD and displacement map.

## 🛠 Tech Stack

- **[Three.js](https://threejs.org/)** & **[React Three Fiber](https://docs.pmnd.rs/react-three-fiber)**: Providing the underlying WebGL abstractions and React integration.
- **[React Three Drei](https://github.com/pmndrs/drei)**: Utilized for its robust library of functional helpers.
- **[React Router](https://reactrouter.com/)**: Managing the application state and view transitions with framework-level precision.
- **[Vite](https://vitejs.dev/)**: The backbone of our development cycle, ensuring rapid HMR and optimized production builds.
- **[Leva](https://github.com/pmndrs/leva)**: Integrated for real-time parameter orchestration and debugging.

## 🌍 The Planet Geometry Algorithm

The project implements a custom dynamic Level of Detail (LOD) system to render detailed planetary surfaces efficiently. The algorithm follows a multi-stage geometric pipeline:

### 1. The Icosahedral Foundation

We start with a unit **Icosahedron** defined by the Golden Ratio ($t = \frac{1 + \sqrt{5}}{2}$). As a Platonic solid with 20 equilateral faces, it provides a highly uniform vertex distribution, serving as the perfect base for spherical projection with minimal distortion.

### 2. Spherical Linear Interpolation (Slerp)

Standard linear interpolation (Lerp) would cause the mesh to "flatten" between vertices, losing the spherical shape. We use **Slerp** to interpolate along the arc of the sphere:
$$Slerp(v_1, v_2, t) = \frac{\sin((1-t)\theta)}{\sin\theta}v_1 + \frac{\sin(t\theta)}{\sin\theta}v_2$$
This ensures every generated vertex maintains a constant radius before displacement.

### 3. Dynamic Level of Detail (LOD)

The resolution of the mesh is calculated dynamically based on proximity to a **target position** (usually the camera):

- **Distance-Based Scaling**: Detail factor is calculated using an inverse distance function.
- **Step Gamma**: A $\gamma$ power is applied to the distance factor to control the "falloff" of detail, preserving high resolution near the target.
- **Quantized Steps**: The final subdivision level ($k$) is snapped to discrete steps to allow for efficient vertex caching and predictable mesh transitions.

### 4. Crack-Free Subdivision & Seam Management

To prevent visible cracks (T-junctions) between neighboring patches of different resolutions, the algorithm implements a **Snap-to-Grid** strategy:

- **Max-Edge Resolution**: Each triangular patch evaluates the required resolution ($k$) for its center and its three edges. It then uses the maximum of these values to ensure edges match.
- **Edge Snapping**: Boundary vertices are explicitly snapped to the resolution of the neighboring edge, ensuring a perfectly sealed manifold regardless of the LOD variance.

### 5. Topological Displacement

Vertices are mapped to **Cylindrical UV coordinates** to sample a heightmap. The final vertex position is displaced along its normal:
$$V_{final} = V_{unit} \times (Radius + SampleHeight(U, V) \times Scale)$$
Post-displacement, normals are recalculated using `computeVertexNormals()` to ensure lighting reacts accurately to the terrain.

### 6. Geometric Synthesis & Optimization

- **Base Subdivision**: The icosahedron is first split into base patches (`baseSub`) for better LOD granularity.
- **Precision-Weighted Hashing**: Vertices are deduplicated using a precision-limited string key (e.g., 6 decimal places) in a hash map, ensuring a smooth, single-manifold mesh without redundant data.

## Credits

The Earth topography and bathymetry data used in these maps are sourced from NASA's Blue Marble: Next Generation project.

**Source:** [NASA Earth Observatory - Blue Marble: Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/#topography)

**Original Data Credit:**
The topography and bathymetry were derived from the General Bathymetric Chart of the Oceans (GEBCO) produced by the British Oceanographic Data Centre (BODC).

These images were combined and processed for use in this project.

Source available. All rights reserved.

In the era of stolen knowledge and exploited labor, I am not sure if this claim of copyright even makes any sense. I paid in tokens to product them, so I shall lay claim.
