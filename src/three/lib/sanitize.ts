import * as THREE from 'three'

/*
 * Every lit material ends in `opaque_fragment`. Sanitise its output: a single
 * NaN or over-bright fragment (a razor-sharp sun glint on glass or water can
 * overflow the half-float scene buffer to Infinity) is spread over the whole
 * screen by the bloom's mip chain and shows up as a black flicker. Replace
 * NaN/Inf with black and cap the radiance well below the half-float limit.
 */
if (!THREE.ShaderChunk.opaque_fragment.includes('fcSafe')) {
  THREE.ShaderChunk.opaque_fragment += `
vec4 fcSafe = gl_FragColor;
if ( any( isnan( fcSafe ) ) || any( isinf( fcSafe ) ) || !all( lessThan( abs( fcSafe ), vec4( 1e6 ) ) ) ) fcSafe = vec4( 0.0, 0.0, 0.0, 1.0 );
gl_FragColor = vec4( min( fcSafe.rgb, vec3( 48.0 ) ), fcSafe.a );
`
}
