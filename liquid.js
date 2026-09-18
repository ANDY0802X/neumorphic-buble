const canvas = document.getElementById("liquid");

// Keep the entire page dark, including any HTML elements outside the canvas.
const darkTheme = document.createElement("style");
darkTheme.textContent = `
  :root { color-scheme: dark; background: #030303; }
  html, body { background: #030303 !important; color: #777 !important; }
  canvas#liquid { background: #030303; }
`;
document.head.appendChild(darkTheme);

const gl = canvas.getContext("webgl2", {
  antialias: true,
  alpha: false,
  powerPreference: "high-performance"
});

if (!gl) {
  throw new Error("WebGL2 is required.");
}


// =====================================================
// VERTEX SHADER
// =====================================================

const vertexShaderSource = `#version 300 es

in vec2 a_position;

out vec2 v_uv;

void main() {

    v_uv = a_position * 0.5 + 0.5;

    gl_Position = vec4(
        a_position,
        0.0,
        1.0
    );
}
`;


// =====================================================
// FRAGMENT SHADER
// =====================================================

const fragmentShaderSource = `#version 300 es

precision highp float;

out vec4 outColor;

in vec2 v_uv;

uniform vec2 u_resolution;
uniform float u_time;

#define COUNT 32

uniform vec4 u_bubbles[COUNT];


// =====================================================
// METABALL FIELD
// =====================================================

float field(vec2 p) {

    float value = 0.0;

    for (int i = 0; i < COUNT; i++) {

        vec2 center = u_bubbles[i].xy;

        float radius = u_bubbles[i].z;

        vec2 d = p - center;

        float distanceSquared =
            dot(d, d);

        float influence =
            exp(
                -pow(
                    sqrt(distanceSquared) /
                    radius,
                    2.25
                )
            );

        value += influence;
    }

    return value;
}


// =====================================================
// FIELD GRADIENT
// =====================================================

vec2 fieldGradient(vec2 p) {

    float e = 0.0018;

    float x =
        field(p + vec2(e, 0.0)) -
        field(p - vec2(e, 0.0));

    float y =
        field(p + vec2(0.0, e)) -
        field(p - vec2(0.0, e));

    return vec2(x, y);
}


// =====================================================
// MAIN
// =====================================================

void main() {

    // -------------------------------------------------
    // Correct aspect ratio
    // -------------------------------------------------

    vec2 aspect = vec2(
        u_resolution.x / u_resolution.y,
        1.0
    );

    vec2 p =
        (v_uv - 0.5) *
        aspect;


    // =================================================
    // BACKGROUND SURFACE
    // =================================================

    /*
       The surface is charcoal.

       The droplets will be considerably darker.
    */

    vec3 background =
        vec3(
        0.08,
        0.07,
        0.07
        );


    // Subtle background radial lighting

    float backgroundLight =
        1.0 -
        distance(
            v_uv,
            vec2(0.42, 0.38)
        );

    background +=
        backgroundLight *
        vec3(
            0.006
        );


    // =================================================
    // LIQUID FIELD
    // =================================================

    float f =
        field(p);


    // Surface threshold

    float surface =
        0.72;


    // Crisp but anti-aliased edge

    float mask =
        smoothstep(
            surface - 0.025,
            surface + 0.012,
            f
        );


    // =================================================
    // SURFACE NORMAL
    // =================================================

    vec2 g =
        fieldGradient(p);


    vec3 normal =
        normalize(
            vec3(
                -g.x * 3.5,
                -g.y * 3.5,
                1.0
            )
        );


    // =================================================
    // LIGHT DIRECTION
    // =================================================

    /*
       Light comes from upper-left.

       This is what makes the droplet
       appear physically raised.
    */

    vec3 lightDirection =
        normalize(
            vec3(
                -0.6,
                -0.7,
                0.75
            )
        );


    float diffuse =
        max(
            dot(
                normal,
                lightDirection
            ),
            0.0
        );


    // =================================================
    // DARK LIQUID MATERIAL
    // =================================================

    /*
       VERY DARK charcoal.

       Background:
          ~0.115

       Droplet:
          ~0.035

       So the droplet is clearly
       darker than the surface.
    */

    vec3 liquid =
        vec3(
        0.012,
        0.012,
        0.012
        );


    // =================================================
    // NEUMORPHIC LIGHT
    // =================================================

    /*
       Extremely restrained light.

       We don't want the droplet
       becoming grey.
    */

    liquid +=
        diffuse *
        vec3(
            0.016,
            0.016,
            0.016
        );


    // =================================================
    // UPPER-LEFT BEVEL
    // =================================================

    float bevel =
        pow(
            diffuse,
            5.0
        );


    liquid +=
        bevel *
        vec3(
            0.016,
            0.016,
            0.016
        );


    // =================================================
    // LOWER-RIGHT CAVITY
    // =================================================

    float cavity =
        1.0 -
        diffuse;


    cavity =
        pow(
            cavity,
            3.2
        );


    liquid -=
        cavity *
        vec3(
            0.012
        );


    // =================================================
    // SUBTLE SPECULAR
    // =================================================

    /*
       Tiny reflection.

       This prevents the droplet from looking
       like a flat black circle.
    */

    float specular =
        pow(
            max(
                normal.z,
                0.0
            ),
            22.0
        );


    liquid +=
        specular *
        vec3(
            0.006
        );


    // =================================================
    // UPPER-LEFT RIM
    // =================================================

    float edgeDistance =
        abs(
            f -
            surface
        );


    float rim =
        1.0 -
        smoothstep(
            0.0,
            0.045,
            edgeDistance
        );


    /*
       Only a tiny highlight.

       This gives the droplet
       a defined physical edge.
    */

    float upperLight =
        max(
            dot(
                normal,
                lightDirection
            ),
            0.0
        );


    liquid +=
        rim *
        upperLight *
        vec3(
            0.012
        );


    // =================================================
    // CONTACT SHADOW
    // =================================================

    /*
       Darkens the region around the
       droplet's lower-right side.

       This creates the impression that
       the droplet is sitting ON the surface.
    */

    float contact =
        smoothstep(
            0.48,
            surface,
            f
        );


    float contactShadow =
        contact *
        (1.0 - diffuse);


    liquid -=
        contactShadow *
        vec3(
            0.010
        );


    // =================================================
    // LOWER-RIGHT CAST SHADOW
    // =================================================

    /*
       Sample the field from the upper-left so the
       shadow falls opposite the light direction.
    */

    float shadowField =
        field(
            p -
            vec2(
                0.055,
                -0.055
            )
        );

    float castShadow =
        smoothstep(
            0.16,
            surface,
            shadowField
        ) *
        (1.0 - mask);


    // =================================================
    // FINAL COMPOSITE
    // =================================================

    vec3 finalColor =
        mix(
            background,
            liquid,
            mask
        );

    finalColor -=
        castShadow *
        vec3(
            0.012,
            0.011,
            0.011
        );


    outColor =
        vec4(
            finalColor,
            1.0
        );
}
`;


// =====================================================
// SHADER CREATION
// =====================================================

function createShader(type, source) {

  const shader =
    gl.createShader(type);

  gl.shaderSource(
    shader,
    source
  );

  gl.compileShader(
    shader
  );


  if (
    !gl.getShaderParameter(
      shader,
      gl.COMPILE_STATUS
    )
  ) {

    console.error(
      gl.getShaderInfoLog(shader)
    );

    throw new Error(
      "Shader compilation failed"
    );
  }


  return shader;
}


// =====================================================
// CREATE PROGRAM
// =====================================================

const vertexShader =
  createShader(
    gl.VERTEX_SHADER,
    vertexShaderSource
  );


const fragmentShader =
  createShader(
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );


const program =
  gl.createProgram();


gl.attachShader(
  program,
  vertexShader
);

gl.attachShader(
  program,
  fragmentShader
);

gl.linkProgram(
  program
);


if (
  !gl.getProgramParameter(
    program,
    gl.LINK_STATUS
  )
) {

  console.error(
    gl.getProgramInfoLog(program)
  );

  throw new Error(
    "Program linking failed"
  );
}


gl.useProgram(
  program
);


// =====================================================
// FULL SCREEN QUAD
// =====================================================

const vertices =
  new Float32Array([

    -1, -1,
     1, -1,
    -1,  1,

    -1,  1,
     1, -1,
     1,  1

  ]);


const buffer =
  gl.createBuffer();


gl.bindBuffer(
  gl.ARRAY_BUFFER,
  buffer
);


gl.bufferData(
  gl.ARRAY_BUFFER,
  vertices,
  gl.STATIC_DRAW
);


const positionLocation =
  gl.getAttribLocation(
    program,
    "a_position"
  );


gl.enableVertexAttribArray(
  positionLocation
);


gl.vertexAttribPointer(
  positionLocation,
  2,
  gl.FLOAT,
  false,
  0,
  0
);


// =====================================================
// UNIFORMS
// =====================================================

const resolutionLocation =
  gl.getUniformLocation(
    program,
    "u_resolution"
  );


const timeLocation =
  gl.getUniformLocation(
    program,
    "u_time"
  );


const bubbleLocations = [];


for (let i = 0; i < 32; i++) {

  bubbleLocations.push(
    gl.getUniformLocation(
      program,
      `u_bubbles[${i}]`
    )
  );
}


// =====================================================
// CANVAS RESIZE
// =====================================================

function resize() {

  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      2
    );


  canvas.width =
    window.innerWidth *
    dpr;

  canvas.height =
    window.innerHeight *
    dpr;


  canvas.style.width =
    `${window.innerWidth}px`;

  canvas.style.height =
    `${window.innerHeight}px`;


  gl.viewport(
    0,
    0,
    canvas.width,
    canvas.height
  );
}


resize();


window.addEventListener(
  "resize",
  resize
);


// =====================================================
// RANDOM
// =====================================================

function random(min, max) {

  return Math.random() *
    (max - min) +
    min;
}


// =====================================================
// BUBBLES
// =====================================================

const bubbles = [];


// =====================================================
// CREATE 32 DROPLETS
// =====================================================

for (let i = 0; i < 32; i++) {

  const angle =
    random(
      0,
      Math.PI * 2
    );


  const speed =
    random(
      0.00005,
      0.00035
    );


  bubbles.push({

    // Position
    x: random(
      -1.0,
      1.0
    ),

    y: random(
      -0.85,
      0.85
    ),


    // Velocity
    vx:
      Math.cos(angle) *
      speed,

    vy:
      Math.sin(angle) *
      speed,


    // Size
    radius:
      random(
        0.055,
        0.17
      ),


    // Individual movement phase
    phase:
      random(
        0,
        Math.PI * 2
      ),


    phaseSpeed:
      random(
        0.00015,
        0.0011
      )
  });
}


// =====================================================
// PHYSICS
// =====================================================

function updateBubbles(time) {

  for (
    const bubble of bubbles
  ) {

    bubble.phase +=
      bubble.phaseSpeed;


    // -------------------------------------------------
    // Very slow organic steering
    // -------------------------------------------------

    bubble.vx +=
      Math.sin(
        time * 0.00018 +
        bubble.phase
      ) *
        0.0000035;


    bubble.vy +=
      Math.cos(
        time * 0.00015 +
        bubble.phase * 1.4
      ) *
      0.0000035;


    // -------------------------------------------------
    // Viscosity
    // -------------------------------------------------

    bubble.vx *=
      0.9997;

    bubble.vy *=
      0.9997;


    // -------------------------------------------------
    // Move
    // -------------------------------------------------

    bubble.x +=
      bubble.vx;

    bubble.y +=
      bubble.vy;


    // -------------------------------------------------
    // Screen bounds
    // -------------------------------------------------

    const aspect =
      window.innerWidth /
      window.innerHeight;


    const xLimit =
      aspect + 0.25;


    const yLimit =
      1.05;


    if (
      bubble.x <
      -xLimit
    ) {

      bubble.x =
        -xLimit;

      bubble.vx =
        Math.abs(
          bubble.vx
        );
    }


    if (
      bubble.x >
      xLimit
    ) {

      bubble.x =
        xLimit;

      bubble.vx =
        -Math.abs(
          bubble.vx
        );
    }


    if (
      bubble.y <
      -yLimit
    ) {

      bubble.y =
        -yLimit;

      bubble.vy =
        Math.abs(
          bubble.vy
        );
    }


    if (
      bubble.y >
      yLimit
    ) {

      bubble.y =
        yLimit;

      bubble.vy =
        -Math.abs(
          bubble.vy
        );
    }
  }
}


// =====================================================
// RENDER LOOP
// =====================================================

const startTime =
  performance.now();


function render(now) {

  const elapsed =
    now -
    startTime;


  // Update physics
  updateBubbles(
    elapsed
  );


  // Send resolution
  gl.uniform2f(
    resolutionLocation,
    window.innerWidth,
    window.innerHeight
  );


  // Send time
  gl.uniform1f(
    timeLocation,
    elapsed
  );


  // Send bubble data
  for (
    let i = 0;
    i < bubbles.length;
    i++
  ) {

    const bubble =
      bubbles[i];


    gl.uniform4f(
      bubbleLocations[i],

      bubble.x,

      bubble.y,

      bubble.radius,

      1.0
    );
  }


  // Draw
  gl.drawArrays(
    gl.TRIANGLES,
    0,
    6
  );


  requestAnimationFrame(
    render
  );
}


requestAnimationFrame(
  render
);