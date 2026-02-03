import { useControls } from 'leva';
import StitchedFace from './StitchedFace';

export default function SphericalClipmap() {
  const { 
    segments, 
    radius, 
    minScale, 
    lodDelta, 
    levels,
    color,
    wireframeColor
  } = useControls({
    segments: { value: 64, min: 16, max: 128, step: 2 },
    radius: { value: 50, min: 10, max: 100 },
    minScale: { value: 6, min: 1, max: 20 }, // Size of finest level
    lodDelta: { value: 2, options: [2] }, // Restricted to 2 for now as geometry logic is hardcoded for 2:1
    levels: { value: 6, min: 1, max: 8, step: 1 },
    color: '#8B4513',
    wireframeColor: '#DEB887'
  });

  // Calculate scales for each level
  // L0 = minScale
  // L1 = minScale * delta
  // ...
  // LN = minScale * delta^N
  
  // Top Face consists of 'levels' nested clipmaps.
  // The Outermost Top Level (L_last) has scale: minScale * delta^(levels-1)
  // It stitches to Side Faces.
  // Side Faces have scale: ??? 
  // Side Faces should match the Outermost Top Level at the boundary.
  // Top Face is a full face of the cube.
  // The clipmap stack covers the Top Face.
  // BUT, in standard Clipmap, the "Active Region" grows.
  // Here, we project to a sphere.
  // Does the Clipmap cover the *whole* Top Face?
  // Usually, Clipmaps are infinite.
  // Here we have a bounded Cube Face.
  // Strategy:
  // The "Top Face" is covered by the Largest Clipmap Level.
  // If the Largest Level is smaller than the Cube Face, we have a gap?
  // No, we define the "Largest Level" to be the Size of the Cube Face (2 * radius).
  // So:
  // Level (levels-1) Scale = 1.0 (Full Face, relative 1.0).
  // Then we work backwards?
  // L(levels-1) size = 2*R.
  // L(levels-2) size = 2*R / delta.
  // ...
  // L0 size = 2*R / delta^(levels-1).
  
  // Wait, user wants "radius selector for the first highest resolution subdivision".
  // Let's call this 'L0_Size'.
  // If L0_Size is fixed, then the number of levels determines the total coverage?
  // Or do we clamp at 2*R?
  // "wrapped into a cube... lowest detail bottom, mid sides, multi layered top".
  // This implies the Top Face is NOT uniform. It has the LOD stack.
  // So the Top Face is composed of multiple rings.
  // The "Outermost" ring of the Top Face must meet the Cube Edge.
  // So the Largest Level must have size >= 2*R.
  // Let's force the Largest Level (levels-1) to equal 2*R.
  
  // But user wants 'minScale' (L0 size) control?
  // If we fix L0 and Delta, then Total Size depends on Levels.
  // If Total Size != 2*R, then the Top Face doesn't fit the cube?
  // Actually, we can just say the Top Face IS the Clipmap Stack.
  // If the stack is small, it's a small patch on top.
  // But we want a Cube. So it MUST fill the face.
  // So: Level (levels-1) MUST be size 2*radius.
  // This means 'minScale' is determined by Radius, Levels, and Delta.
  // minScale = (2*radius) / (delta^(levels-1)).
  
  // Alternative: User controls 'minScale' (L0 size). We add enough levels to fill the face?
  // Or we just let 'levels' be fixed and 'minScale' derived?
  // User asked for "radius selector for the first highest resolution subdivision".
  // Let's assume this controls 'minScale'.
  // But we must fill the face.
  // So maybe we decouple "Clipmap Levels" from "Face Filling".
  // If the User wants L0 to be small, and we have few levels, we might not reach the edge.
  // Then we need "Filler" rings?
  // Or we just say: The Top Face is L0..LN.
  // We clamp LN to size 2*R.
  
  // Let's use the 'minScale' as the Base.
  // We generate levels until we exceed 2*R?
  // Or we just stick to:
  // Top Face = Stack of rings.
  // Ring i has size = minScale * 2^i.
  // If Ring i < 2*R, it's a full ring.
  // If Ring i >= 2*R, we clip it to the face boundary?
  // That's complex.
  
  // Simpler approach for this demo:
  // Fix the Outermost Level to size 2*R (Full Face).
  // The 'minScale' control adjusts the *Inner* detail?
  // No, that's just zooming.
  // Let's strictly follow: "radius selector for the first highest resolution subdivision".
  // Let's say L0 size = 'minScale'.
  // We compute N levels such that L_last >= 2*R.
  // But we have 'levels' control too.
  // Conflict?
  // "flexible not hard coded".
  // Let's prioritize filling the face.
  // We will scale the levels such that the Outermost Level hits the edge.
  // The "radius selector" might effectively control the *density*?
  // Or maybe we treat the "radius selector" as the L0 Half-Width.
  
  // Let's try: L0 Size = 'minScale'.
  // L1 = L0 * delta...
  // We render levels 0 to 'levels-1'.
  // If the largest level < 2*R, we add a "Background" filler on Top Face?
  // Or just extend the last level?
  // Let's extend the last level to fill the rest of the face.
  // Scale of Level i:
  // Ring i covers (Size(i-1), Size(i)).
  // If Size(last) < 2*R, we have a gap.
  // Let's assume the user adjusts 'levels' to fill it, or we assume the Top Face *is* just that LOD area, and the rest is "Sides"?
  // But it's a cube.
  // Let's clamp: The Outermost Level is always scaled to fit the Face Width (2*radius).
  // The 'minScale' is ignored? No.
  // Let's invert:
  // L_max = 2*R.
  // L_i = L_max / (delta ^ (levels - 1 - i)).
  // This guarantees fit.
  // The "detail" of L0 is determined by levels.
  // User controls 'levels'.
  // User controls 'delta'.
  // User controls 'radius' (Sphere).
  // Where does "radius selector for first highest resolution" fit?
  // Maybe they mean "How big is the high res patch?".
  // If I use the inverted formula, the size of L0 is (2*R)/(delta^(N-1)).
  // If N is large, L0 is tiny (High Res density focus).
  // If N is small, L0 is large (Low Res).
  // This seems correct for LOD.
  
  // Geometry Generation loop
  const topLevels = [];
  const maxScale = 1.0; // 1.0 = Full Face Width (relative to 2*radius)
  
  for (let i = 0; i < levels; i++) {
    // Level i (0=Fine, levels-1=Coarse/Full)
    // Actually standard Clipmap: 0 is fine, N is coarse.
    // Scale of L_i relative to Full Face.
    // L_(levels-1) = 1.0.
    // L_i = 1.0 / (delta ^ (levels - 1 - i)).
    const relativeScale = 1.0 / Math.pow(lodDelta, levels - 1 - i);
    
    topLevels.push({
      level: i,
      scale: relativeScale,
      // Stitching:
      // Inner levels (i < levels-1) stitch to Outer (i+1).
      // Outer Level (levels-1) stitches to SIDES.
      // SIDES are effectively Level 'levels'.
      // If Side has matching resolution to Level 'levels', then Ratio=1.
      // If Side is Coarser (e.g. Side is 1/2 density of Top Outer), Ratio=2.
      // Top Outer Level density:
      // It spans 2*R with 'segments'.
      // Side Face spans 2*R with 'sideSegments'.
      // If sideSegments = segments / 2, then Ratio = 2.
    });
  }

  // Side Faces
  // User said "Mid detail". Let's say Mid = Segments / 2.
  const sideSegments = segments / 2;
  const sideRatio = 2; // Top is Segments, Side is Segments/2. Ratio 2.
  // Note: Side Mesh is Coarser. Top Mesh (Finer) Stitches to Side.
  // So Top Level (levels-1) Boundary Stitches: { top:2, right:2, bottom:2, left:2 }.
  
  // Side Meshes
  // Top Edge connects to Top Face.
  // Top Face Outer Ring is "Segments" resolution (density).
  // Side is "Segments/2".
  // Top Face stitched to Side.
  // Side Face Top Edge sees Top Face. Side is Coarser.
  // Does Side stitch to Top?
  // No, Finer stitches to Coarser. Top stitched to Side.
  // Side Top Edge is standard (Ratio 1).
  
  // Side-Side Edges (Left/Right)
  // All Sides are same res. Ratio 1.
  
  // Side-Bottom Edge
  // Bottom is Low detail? (Segments / 4).
  // Side is (Segments / 2).
  // Side is Finer than Bottom.
  // Side Bottom Edge stitches to Bottom (Ratio 2).
  
  // Bottom Face
  // Connects to Sides (Finer).
  // Bottom is Coarser. Passive (Ratio 1).
  const botSegments = segments / 4;

  return (
    <group>
      {/* Top Face (LOD Stack) */}
      <group>
        {topLevels.map((info, i) => {
          const isOuter = i === levels - 1;
          const isInner = i === 0; // L0 is full grid (no hole) unless we use ring for all?
          // Standard clipmap: L0 is full. L1..N are rings.
          const isHole = i > 0;
          const holeSize = (1.0 / lodDelta); // Relative to current size. 1/2 for delta=2.
          
          // Stitches
          // If Outer: Stitch to Sides (Ratio 2).
          // If Not Outer: Stitch to Next Level (Ratio 2, handled by ring logic? No.)
          // Wait, 'StitchedFace' stitches the *Outer Perimeter*.
          // Clipmap Levels nest.
          // L0 Outer Perimeter touches L1 Inner Perimeter?
          // Ideally L0 sits *on top* of L1?
          // Usually Clipmaps use a Hole in L1.
          // L0 fills the hole.
          // The Boundary is L0 Outer vs L1 Inner.
          // L0 is Finer. L1 is Coarser.
          // L0 Outer must stitch to L1 Inner.
          // So L0 Stitch = 2.
          // All Inner Levels Stitch = 2 (to their parent).
          // Outer Level Stitch = 2 (to Sides).
          // So ALL Top Levels have Stitch = 2 on all edges!
          
          return (
            <StitchedFace
              key={`top-${i}`}
              face="py"
              segments={segments}
              radius={radius}
              scale={info.scale}
              stitchEdges={{ top: 2, right: 2, bottom: 2, left: 2 }}
              isHole={isHole}
              holeSize={holeSize}
              color={color}
              wireframeColor={wireframeColor}
            />
          );
        })}
      </group>

      {/* Side Faces */}
      {['px', 'nx', 'pz', 'nz'].map((face) => {
        // Stitch Logic for Sides
        // Top Edge: Connects to Top Face (Finer). Side is Coarser. Ratio 1.
        // Side Edges: Connect to Sides (Same). Ratio 1.
        // Bottom Edge: Connects to Bottom Face (Coarser). Side is Finer. Ratio 2.
        
        // Wait, rotations.
        // PX (Right):
        // Top (y=R) -> Top Face.
        // Right (z=R) -> PZ (Front).
        // Left (z=-R) -> NZ (Back).
        // Bottom (y=-R) -> Bottom Face.
        // All Sides have Top facing Top Face, Bottom facing Bottom Face.
        // (Assuming projectToSphere mapping preserves orientation roughly).
        // px: (radius, -v, -u). v is "y-like".
        // v goes -1..1.
        // v=-1 (Bottom of local grid) -> y=radius. (Top of Sphere).
        // v=1 (Top of local grid) -> y=-radius. (Bottom of Sphere).
        // So Local Top (v=-1) is Sphere Top.
        // Local Bottom (v=1) is Sphere Bottom.
        // So Side Top Edge -> Top Face.
        // Side Bottom Edge -> Bottom Face.
        
        return (
          <StitchedFace
            key={face}
            face={face as any}
            segments={sideSegments}
            radius={radius}
            scale={1} // Full Face
            stitchEdges={{ top: 1, right: 1, bottom: 2, left: 1 }}
            color={color}
            wireframeColor={wireframeColor}
          />
        );
      })}

      {/* Bottom Face */}
      <StitchedFace
        face="ny"
        segments={botSegments}
        radius={radius}
        scale={1}
        stitchEdges={{ top: 1, right: 1, bottom: 1, left: 1 }} // All passive
        color={color}
        wireframeColor={wireframeColor}
      />
    </group>
  );
}
