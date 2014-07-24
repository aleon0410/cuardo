
ShaderDraping = {

// Vertex shader to move vertices the same way we move the terrain
// the number of divisions for the tile is used to fetch the altitude of the
// 3 vertices of the terrain triangle the vertex is on.
//
	'draping' : {

		uniforms: THREE.UniformsUtils.merge( [

			THREE.UniformsLib[ "fog" ],
			THREE.UniformsLib[ "lights" ],
			THREE.UniformsLib[ "shadowmap" ],

			{

			"nbOfDivisions"  : { type: "i", value: 0 },

			"tDisplacement": { type: "t", value: null },

			"uDisplacementScale": { type: "f", value: 1.0 },

			"color": { type: "c", value: new THREE.Color( 0xeeeeee ) },
			"opacity": { type: "f", value: 1 },
			"uZoffset": { type: "f", value: .1 },
			}

		] ),

		fragmentShader: [

			"uniform vec3 color;",
			"uniform float opacity;",

			"uniform sampler2D tDisplacement;",

			"varying vec3 vTangent;",
			"varying vec3 vBinormal;",
			"varying vec3 vNormal;",
			"varying vec2 vUv;",

			"uniform vec3 ambientLightColor;",

			"varying vec3 vViewPosition;",

			THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
			THREE.ShaderChunk[ "fog_pars_fragment" ],

			"void main() {",

				"gl_FragColor = vec4( color, opacity );",
                                //"gl_FragColor = vec4( texture2D( tDisplacement, vUv ).xyz, 1.);",
                                //"gl_FragColor = vec4( vUv.x, vUv.y, 0., 1.);",
                                //"gl_FragColor = vec4( vUv.x, vUv.y, 0., 1.);",

				THREE.ShaderChunk[ "shadowmap_fragment" ],
				THREE.ShaderChunk[ "linear_to_gamma_fragment" ],
				THREE.ShaderChunk[ "fog_fragment" ],

			"}"

		].join("\n"),

		vertexShader: [

			"attribute vec4 tangent;",

			"#ifdef VERTEX_TEXTURES",

				"uniform sampler2D tDisplacement;",
				"uniform float uDisplacementScale;",
				"uniform float uZoffset;",

			"#endif",

			"varying vec3 vTangent;",
			"varying vec3 vBinormal;",
			"varying vec3 vNormal;",
			"varying vec2 vUv;",

			"varying vec3 vViewPosition;",

			THREE.ShaderChunk[ "shadowmap_pars_vertex" ],

			"void main() {",

				"vNormal = normalize( normalMatrix * normal );",

				// tangent and binormal vectors

				"vTangent = normalize( normalMatrix * tangent.xyz );",

				"vBinormal = cross( vNormal, vTangent ) * tangent.w;",
				"vBinormal = normalize( vBinormal );",

				// texture coordinates

				"vUv = uv;",

				// displacement mapping

				"#ifdef VERTEX_TEXTURES",

					"vec3 dv = texture2D( tDisplacement, vUv ).xyz;",
					"float df = uDisplacementScale * dv.x ;",
					"vec3 displacedPosition = vec3(0,0,1) * (df + uZoffset) + position;",

					"vec4 worldPosition = modelMatrix * vec4( displacedPosition, 1.0 );",
					"vec4 mvPosition = modelViewMatrix * vec4( displacedPosition, 1.0 );",

				"#else",

					"vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
					"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",

				"#endif",

				"gl_Position = projectionMatrix * mvPosition;",

				"vViewPosition = -mvPosition.xyz;",

				//"vec3 normalTex = texture2D( tNormal, uvBase ).xyz * 2.0 - 1.0;",
				//"vNormal = normalMatrix * normalTex;",

				THREE.ShaderChunk[ "shadowmap_vertex" ],


			"}"

		].join("\n")

	}

};
