/* =====================================================================
   Los Angeles Sky
   ---------------------------------------------------------------------
   A generative sky for the homepage. Nothing here is a preset image:
   the colour of the sky is solved every frame from where the sun
   actually is over Los Angeles right now, and the weather on top of it
   is pulled live from Open-Meteo.

   Light        Rayleigh + Mie single-scattering, raymarched through a
                spherical atmosphere (blue days, red sunsets, and the
                long violet twilight all fall out of the same integral)
   Clouds       fractal Brownian motion noise with domain warping,
                lit by a two-tap density gradient toward the sun
   Astronomy    low-precision solar and lunar ephemerides, so the sun
                arc, the moon's position, and its phase are all real

   Katalina Vasquez, 2026
   ===================================================================== */

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Los Angeles
  // ---------------------------------------------------------------
  var LAT = 34.0522;
  var LON = -118.2437;
  var VIEW_HEADING = 256;   // degrees from north: looking WSW, toward the ocean
  var VIEW_PITCH = 20;      // degrees above the horizon: mostly sky, a sliver of basin

  // ---------------------------------------------------------------
  // Astronomy  (low-precision ephemerides, ~1 arcmin for the sun)
  // ---------------------------------------------------------------
  var RAD = Math.PI / 180;
  var OBLIQUITY = 23.4397 * RAD;

  function toDays(date) {
    return date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545;
  }
  function rightAscension(l, b) {
    return Math.atan2(
      Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
      Math.cos(l)
    );
  }
  function declination(l, b) {
    return Math.asin(
      Math.sin(b) * Math.cos(OBLIQUITY) +
      Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)
    );
  }
  function siderealTime(d, lw) {
    return RAD * (280.16 + 360.9856235 * d) - lw;
  }
  function altitude(H, phi, dec) {
    return Math.asin(
      Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
    );
  }
  function azimuthFromSouth(H, phi, dec) {
    return Math.atan2(
      Math.sin(H),
      Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
    );
  }

  function sunCoords(d) {
    var M = RAD * (357.5291 + 0.98560028 * d);
    var C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var L = M + C + RAD * 102.9372 + Math.PI;
    return { dec: declination(L, 0), ra: rightAscension(L, 0) };
  }

  function moonCoords(d) {
    var L = RAD * (218.316 + 13.176396 * d);   // ecliptic longitude
    var M = RAD * (134.963 + 13.064993 * d);   // mean anomaly
    var F = RAD * (93.272 + 13.229350 * d);    // argument of latitude
    var l = L + RAD * 6.289 * Math.sin(M);
    var b = RAD * 5.128 * Math.sin(F);
    var dt = 385001 - 20905 * Math.cos(M);     // km to the moon
    return { ra: rightAscension(l, b), dec: declination(l, b), dist: dt };
  }

  /* Returns { sun:{alt,az}, moon:{alt,az}, moonFraction, moonLimbAngle } */
  function skyGeometry(date) {
    var lw = RAD * -LON;
    var phi = RAD * LAT;
    var d = toDays(date);

    var s = sunCoords(d);
    var Hs = siderealTime(d, lw) - s.ra;
    var sunAlt = altitude(Hs, phi, s.dec);
    var sunAz = azimuthFromSouth(Hs, phi, s.dec) + Math.PI; // from north

    var m = moonCoords(d);
    var Hm = siderealTime(d, lw) - m.ra;
    var moonAlt = altitude(Hm, phi, m.dec);
    var moonAz = azimuthFromSouth(Hm, phi, m.dec) + Math.PI;
    // Atmospheric refraction lifts a low moon by about half a degree.
    // The approximation is only valid at or above the horizon; below
    // it the tangent blows up and throws the moon across the sky.
    if (moonAlt >= 0) {
      moonAlt += 0.0002967 / Math.tan(moonAlt + 0.00312536 / (moonAlt + 0.08901179));
    }

    // illuminated fraction and the tilt of the bright limb
    var sdist = 149598000;
    var dRa = s.ra - m.ra;
    var phase = Math.acos(
      Math.sin(s.dec) * Math.sin(m.dec) +
      Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(dRa)
    );
    var inc = Math.atan2(sdist * Math.sin(phase), m.dist - sdist * Math.cos(phase));
    var limb = Math.atan2(
      Math.cos(s.dec) * Math.sin(dRa),
      Math.sin(s.dec) * Math.cos(m.dec) -
      Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(dRa)
    );

    return {
      sun: { alt: sunAlt, az: sunAz },
      moon: { alt: moonAlt, az: moonAz },
      moonFraction: (1 + Math.cos(inc)) / 2,
      moonLimbAngle: limb
    };
  }

  // altitude/azimuth -> world vector, with x = east, y = up, z = north
  function toVector(alt, az) {
    var ca = Math.cos(alt);
    return [ca * Math.sin(az), Math.sin(alt), ca * Math.cos(az)];
  }

  // ---------------------------------------------------------------
  // Weather  (WMO codes -> what the shader needs to draw)
  // ---------------------------------------------------------------
  var WMO = {
    0:  ['Clear',              0.00, 0.00, 0.00],
    1:  ['Mostly clear',       0.18, 0.00, 0.00],
    2:  ['Partly cloudy',      0.45, 0.00, 0.00],
    3:  ['Overcast',           0.92, 0.00, 0.00],
    45: ['Fog',                0.75, 0.00, 0.95],
    48: ['Freezing fog',       0.75, 0.00, 0.95],
    51: ['Light drizzle',      0.75, 0.22, 0.35],
    53: ['Drizzle',            0.82, 0.34, 0.40],
    55: ['Heavy drizzle',      0.88, 0.46, 0.45],
    56: ['Freezing drizzle',   0.85, 0.35, 0.45],
    57: ['Freezing drizzle',   0.88, 0.45, 0.50],
    61: ['Light rain',         0.85, 0.40, 0.40],
    63: ['Rain',               0.92, 0.65, 0.50],
    65: ['Heavy rain',         0.97, 0.92, 0.62],
    66: ['Freezing rain',      0.92, 0.60, 0.55],
    67: ['Freezing rain',      0.95, 0.80, 0.60],
    71: ['Light snow',         0.90, 0.30, 0.55],
    73: ['Snow',               0.94, 0.45, 0.62],
    75: ['Heavy snow',         0.97, 0.60, 0.70],
    77: ['Snow grains',        0.88, 0.30, 0.50],
    80: ['Light showers',      0.72, 0.42, 0.28],
    81: ['Showers',            0.82, 0.62, 0.34],
    82: ['Violent showers',    0.94, 0.95, 0.48],
    85: ['Snow showers',       0.88, 0.40, 0.50],
    86: ['Snow showers',       0.94, 0.60, 0.60],
    95: ['Thunderstorm',       0.96, 0.80, 0.55],
    96: ['Thunderstorm',       0.97, 0.88, 0.60],
    99: ['Thunderstorm',       0.99, 0.95, 0.65]
  };

  var weather = {
    label: 'clear',
    tempF: null,
    cloud: 0.22,
    rain: 0.0,
    fog: 0.05,
    haze: 0.35,      // LA is never truly clean air
    wind: 5,
    live: false
  };

  function applyWeather(json) {
    var c = json && json.current;
    if (!c) throw new Error('no current block');

    var code = typeof c.weather_code === 'number' ? c.weather_code : 0;
    var entry = WMO[code] || WMO[0];

    weather.label = entry[0].toLowerCase();
    weather.tempF = typeof c.temperature_2m === 'number' ? Math.round(c.temperature_2m) : null;
    weather.rain = entry[2];
    weather.fog = entry[3];
    weather.wind = typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : 5;

    // Prefer the measured cloud fraction; fall back to the code's estimate.
    weather.cloud = (typeof c.cloud_cover === 'number')
      ? Math.min(1, c.cloud_cover / 100)
      : entry[1];

    // Humidity thickens the marine layer haze that sits over the basin.
    var rh = typeof c.relative_humidity_2m === 'number' ? c.relative_humidity_2m : 55;
    weather.haze = Math.min(1, 0.28 + (rh - 40) / 130 + weather.rain * 0.3);

    weather.live = true;
  }

  function fetchWeather() {
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=' + LAT + '&longitude=' + LON
      + '&current=temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m'
      + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FLos_Angeles';

    return fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(applyWeather)
      .catch(function () { /* the sky still works without a forecast */ });
  }

  // ---------------------------------------------------------------
  // Preview overrides
  // ---------------------------------------------------------------
  // Handy for looking at the sky at a time or in weather that isn't
  // happening right now, e.g.
  //   index.html?at=2026-08-12T19:40&cloud=0.7&rain=0.5
  var OVERRIDE = (function () {
    var o = {};
    try {
      var q = new URLSearchParams(window.location.search);
      if (q.has('at')) {
        var d = new Date(q.get('at'));
        if (!isNaN(d.valueOf())) o.date = d;
      }
      ['cloud', 'rain', 'fog', 'haze', 'wind'].forEach(function (k) {
        if (q.has(k)) o[k] = parseFloat(q.get(k));
      });
    } catch (e) { /* no URLSearchParams, no overrides */ }
    return o;
  })();

  function now() {
    return OVERRIDE.date ? new Date(OVERRIDE.date) : new Date();
  }

  // ---------------------------------------------------------------
  // Press settings
  // ---------------------------------------------------------------
  var press = {
    dot: 3.6,      // halftone cell size in CSS pixels, so the screen
                   // stays the same physical size on any display
    ink: 0.62,     // how hard the screen bites into the image
    grain: 0.055   // paper grain
  };
  ['dot', 'ink', 'grain'].forEach(function (k) {
    try {
      var q = new URLSearchParams(window.location.search);
      if (q.has(k)) {
        var v = parseFloat(q.get(k));
        if (!isNaN(v)) press[k] = v;
      }
    } catch (e) { /* no overrides */ }
  });

  function applyOverrides() {
    ['cloud', 'rain', 'fog', 'haze', 'wind'].forEach(function (k) {
      if (typeof OVERRIDE[k] === 'number' && !isNaN(OVERRIDE[k])) weather[k] = OVERRIDE[k];
    });
  }

  // ---------------------------------------------------------------
  // Shaders
  // ---------------------------------------------------------------
  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    '',
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec3  uSun;',
    'uniform vec3  uMoon;',
    'uniform float uMoonPhase;',
    'uniform float uMoonLimb;',
    'uniform float uCloud;',
    'uniform float uRain;',
    'uniform float uFog;',
    'uniform float uHaze;',
    'uniform float uWind;',
    'uniform vec2  uLook;',
    'uniform vec3  uSunTint;',   // scattering solved along the sun ray
    'uniform vec3  uZenith;',    // scattering solved straight up
    'uniform float uDot;',       // halftone cell size, in render pixels (CSS px x scale)
    'uniform float uInk;',       // how hard the screen bites
    'uniform float uGrain;',     // paper grain
    '',
    'const float PI = 3.141592653589793;',
    '',
    '/* ---------------- Rayleigh + Mie scattering ----------------',
    '   Single-scattering integral through a spherical atmosphere.',
    '   The outer loop marches the view ray; the inner loop marches',
    '   back toward the sun to find how much light survives the trip. */',
    '',
    '// ray/sphere intersection. The miss sentinel has to be far larger',
    '// than any real distance in the scene, or a near-horizontal ray',
    '// that misses the planet gets silently truncated.',
    'vec2 rsi(vec3 r0, vec3 rd, float sr){',
    '  float a = dot(rd, rd);',
    '  float b = 2.0 * dot(rd, r0);',
    '  float c = dot(r0, r0) - sr * sr;',
    '  float d = b * b - 4.0 * a * c;',
    '  if (d < 0.0) return vec2(1e12, -1e12);',
    '  d = sqrt(d);',
    '  return vec2((-b - d) / (2.0 * a), (-b + d) / (2.0 * a));',
    '}',
    '',
    'const int I_STEPS = 12;',
    'const int J_STEPS = 6;',
    'const float R_PLANET = 6371000.0;',
    'const float R_ATMOS  = 6471000.0;',
    'const float SH_RLH   = 8000.0;',
    'const float SH_MIE   = 1200.0;',
    'const float G_MIE    = 0.758;',
    '',
    'vec3 atmosphere(vec3 rd, vec3 ro, vec3 sun, float intensity, vec3 kRlh, float kMie){',
    '  vec2 p = rsi(ro, rd, R_ATMOS);',
    '  if (p.x > p.y) return vec3(0.0);',
    '  // stop at the ground if the ray hits it, ahead of the camera only',
    '  vec2 g = rsi(ro, rd, R_PLANET);',
    '  if (g.y > 0.0 && g.x > 0.0) p.y = min(p.y, g.x);',
    '  // the camera sits inside the atmosphere, so the near root is',
    '  // behind us; marching from there samples empty space',
    '  p.x = max(p.x, 0.0);',
    '  float iStep = (p.y - p.x) / float(I_STEPS);',
    '  float iT = p.x;',
    '',
    '  vec3 totalR = vec3(0.0);',
    '  vec3 totalM = vec3(0.0);',
    '  float odR = 0.0;',
    '  float odM = 0.0;',
    '',
    '  float mu = dot(rd, sun);',
    '  float mumu = mu * mu;',
    '  float gg = G_MIE * G_MIE;',
    '  float phaseR = 3.0 / (16.0 * PI) * (1.0 + mumu);',
    '  float phaseM = 3.0 / (8.0 * PI) * ((1.0 - gg) * (mumu + 1.0)) /',
    '                 (pow(1.0 + gg - 2.0 * mu * G_MIE, 1.5) * (2.0 + gg));',
    '',
    '  for (int i = 0; i < I_STEPS; i++){',
    '    vec3 iPos = ro + rd * (iT + iStep * 0.5);',
    '    float h = length(iPos) - R_PLANET;',
    '    float dR = exp(-h / SH_RLH) * iStep;',
    '    float dM = exp(-h / SH_MIE) * iStep;',
    '    odR += dR;',
    '    odM += dM;',
    '',
    '    float jStep = rsi(iPos, sun, R_ATMOS).y / float(J_STEPS);',
    '    float jT = 0.0;',
    '    float jOdR = 0.0;',
    '    float jOdM = 0.0;',
    '    for (int j = 0; j < J_STEPS; j++){',
    '      vec3 jPos = iPos + sun * (jT + jStep * 0.5);',
    '      float jh = length(jPos) - R_PLANET;',
    '      jOdR += exp(-jh / SH_RLH) * jStep;',
    '      jOdM += exp(-jh / SH_MIE) * jStep;',
    '      jT += jStep;',
    '    }',
    '',
    '    vec3 attn = exp(-(kMie * (odM + jOdM) + kRlh * (odR + jOdR)));',
    '    totalR += dR * attn;',
    '    totalM += dM * attn;',
    '    iT += iStep;',
    '  }',
    '  return intensity * (phaseR * kRlh * totalR + phaseM * kMie * totalM);',
    '}',
    '',
    '/* ---------------- fractal Brownian motion ---------------- */',
    '',
    'float hash21(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    '',
    'float vnoise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  float a = hash21(i);',
    '  float b = hash21(i + vec2(1.0, 0.0));',
    '  float c = hash21(i + vec2(0.0, 1.0));',
    '  float d = hash21(i + vec2(1.0, 1.0));',
    '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
    '}',
    '',
    '// each octave is half the amplitude and ~2x the frequency of the',
    '// last; the rotation keeps the lattice from lining up into grids',
    'float fbm4(vec2 p){',
    '  mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++){ v += a * vnoise(p); p = rot * p; a *= 0.5; }',
    '  return v;',
    '}',
    '',
    'float fbm6(vec2 p){',
    '  mat2 rot = mat2(1.6, 1.2, -1.2, 1.6);',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 6; i++){ v += a * vnoise(p); p = rot * p; a *= 0.5; }',
    '  return v;',
    '}',
    '',
    '/* Domain-warped fBm: noise whose own coordinates are displaced by',
    '   noise. This is what gives clouds billows instead of blobs. */',
    'float clouds(vec2 p, float t){',
    '  vec2 q = vec2(fbm4(p + vec2(0.0, t * 0.05)), fbm4(p + vec2(5.2, 1.3)));',
    '  vec2 r = vec2(fbm4(p + 2.6 * q + vec2(1.7, 9.2) + t * 0.03),',
    '                fbm4(p + 2.6 * q + vec2(8.3, 2.8)));',
    '  return fbm6(p + 1.9 * r);',
    '}',
    '',
    '/* ---------------- cloud deck ----------------',
    '   The deck is a flat plane at a given altitude. We intersect the',
    '   view ray with it, sample the noise field there, then take a',
    '   second sample a short step toward the sun. The difference in',
    '   density is the light that got through: cheap self-shadowing. */',
    '',
    'vec4 deck(vec3 rd, vec3 sun, float height, float scale, float cover,',
    '          float softness, float t, float speed){',
    '  if (rd.y < 0.004) return vec4(0.0);',
    '  float dist = height / rd.y;',
    '  vec2 p = rd.xz * dist * scale;',
    '  p += vec2(t * speed, t * speed * 0.35);',
    '',
    '  float d = clouds(p, t);',
    '  float lo = 1.0 - cover;',
    '  float density = smoothstep(lo, lo + softness, d);',
    '  if (density <= 0.001) return vec4(0.0);',
    '',
    '  // fade the deck into the horizon so the noise never aliases',
    '  density *= smoothstep(0.004, 0.16, rd.y);',
    '',
    '  // Compare raw noise rather than thresholded density, otherwise',
    '  // the shading collapses into a hard ink outline at the edges.',
    '  vec2 toSun = normalize(sun.xz + vec2(0.0001)) * 0.55;',
    '  float dLit = clouds(p + toSun, t);',
    '  float light = clamp((d - dLit) * 3.2 + 0.55, 0.0, 1.0);',
    '',
    '  return vec4(light, density, 0.0, 0.0);',
    '}',
    '',
    '/* ---------------- night ---------------- */',
    '',
    'float stars(vec3 rd){',
    '  vec3 s = rd * 210.0;',
    '  vec3 i = floor(s);',
    '  vec3 f = fract(s) - 0.5;',
    '  float h = hash21(i.xy + i.z * 37.13);',
    '  // only the brightest few percent of cells hold a star, and the',
    '  // magnitude curve keeps most of those faint',
    '  float mag = smoothstep(0.955, 1.0, h);',
    '  float shape = 1.0 - smoothstep(0.0, 0.42, length(f));',
    '  float twinkle = 0.6 + 0.4 * sin(uTime * 2.4 + h * 90.0);',
    '  return mag * mag * shape * twinkle * smoothstep(-0.02, 0.20, rd.y) * 2.6;',
    '}',
    '',
    'vec3 moonDisc(vec3 rd, vec3 moon, float phase, float limb){',
    '  float c = dot(rd, moon);',
    '  if (c < 0.9990) return vec3(0.0);',
    '  // local coordinates across the face of the disc',
    '  vec3 ref = abs(moon.y) > 0.995 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);',
    '  vec3 rt = normalize(cross(ref, moon));',
    '  vec3 up = normalize(cross(moon, rt));',
    '  vec2 uv = vec2(dot(rd, rt), dot(rd, up)) / 0.0155;',
    '  float r = length(uv);',
    '  if (r > 1.0) return vec3(0.0);',
    '',
    '  // terminator: rotate into the bright-limb frame, then carve the',
    '  // ellipse that separates the lit face from the dark one',
    '  float ca = cos(limb), sa = sin(limb);',
    '  vec2 q = vec2(uv.x * ca - uv.y * sa, uv.x * sa + uv.y * ca);',
    '  float k = 1.0 - 2.0 * phase;                 // -1 full ... +1 new',
    '  float term = k * sqrt(max(0.0, 1.0 - q.y * q.y));',
    '  float lit = smoothstep(term - 0.05, term + 0.05, q.x);',
    '',
    '  float maria = 0.86 + 0.14 * fbm4(uv * 2.4 + 11.0);',
    '  float edge = smoothstep(1.0, 0.90, r);',
    '  return vec3(1.0, 0.985, 0.94) * lit * maria * edge * 1.5;',
    '}',
    '',
    '/* ---------------- rain ---------------- */',
    '',
    'float rainStreaks(vec2 uv, float t){',
    '  float acc = 0.0;',
    '  for (int k = 0; k < 3; k++){',
    '    float fk = float(k);',
    '    float sc = 44.0 + fk * 31.0;',
    '    vec2 q = uv * vec2(sc, sc * 0.075);',
    '    q.x += q.y * 0.45;',
    '    q.y -= t * (7.0 + fk * 4.0);',
    '    vec2 id = floor(q);',
    '    vec2 f = fract(q);',
    '    float h = hash21(id + fk * 21.7);',
    '    float on = step(0.945, h);',
    '    float line = smoothstep(0.40, 0.5, 1.0 - abs(f.x - 0.5) * 2.0);',
    '    float len = smoothstep(0.0, 0.40, f.y) * smoothstep(1.0, 0.50, f.y);',
    '    acc += on * line * len * (0.35 + 0.65 * h);',
    '  }',
    '  return clamp(acc, 0.0, 1.0);',
    '}',
    '',
    '// ordered dither, kills banding in the big smooth gradients',
    'float dither(vec2 fc){',
    '  return fract(sin(dot(fc, vec2(12.9898, 78.233))) * 43758.5453);',
    '}',
    '',
    '/* ---------------- print texture ----------------',
    '   A halftone screen the way a press actually lays down tone: the',
    '   dots sit on a fixed grid at a fixed spacing, and it is their',
    '   RADIUS that carries the image. Shadows grow fat dots that nearly',
    '   touch; highlights shrink to pinpricks. The grid is rotated off',
    '   the pixel axes so it never moires against the screen. */',
    '',
    'float halftone(vec2 fc, float lum, float ang, float size){',
    '  float c = cos(ang), s = sin(ang);',
    '  vec2 p = vec2(fc.x * c - fc.y * s, fc.x * s + fc.y * c) / size;',
    '  vec2 f = fract(p) - 0.5;',
    '  float r = sqrt(clamp(1.0 - lum, 0.0, 1.0)) * 0.54;',
    '  return smoothstep(r + 0.10, r - 0.10, length(f));',
    '}',
    '',
    'void main(){',
    '  vec2 fc = gl_FragCoord.xy;',
    '  vec2 uv = (fc - 0.5 * uRes) / uRes.y;',
    '',
    '  // camera basis from heading + pitch',
    '  float yaw = uLook.x;',
    '  float pit = uLook.y;',
    '  vec3 fwd = vec3(sin(yaw) * cos(pit), sin(pit), cos(yaw) * cos(pit));',
    '  vec3 rt  = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));',
    '  vec3 up  = cross(fwd, rt);',
    '  vec3 rd  = normalize(fwd + uv.x * rt * 1.05 + uv.y * up * 1.05);',
    '',
    '  vec3 ro = vec3(0.0, R_PLANET + 400.0, 0.0);',
    '  vec3 sun = normalize(uSun);',
    '',
    '  // Haze and rain load the air with aerosol: more Mie, less blue.',
    '  float mie = 21e-6 * (1.0 + uHaze * 1.4 + uRain * 2.0 + uFog * 3.0);',
    '  // Rayleigh cross-sections at 680 / 550 / 440 nm, per metre.',
    '  // Blue scatters about six times as hard as red; that ratio is',
    '  // the whole reason the sky is blue and the sunset is not.',
    '  vec3 rlh = vec3(5.8e-6, 13.5e-6, 33.1e-6);',
    '',
    '  vec3 sky = atmosphere(rd, ro, sun, 22.0, rlh, mie);',
    '',
    '  // the sun itself, plus the bloom the atmosphere smears around it',
    '  float cosSun = dot(rd, sun);',
    '  float disc = smoothstep(0.99991, 0.99997, cosSun);',
    '  sky += uSunTint * disc * 7.0;',
    '  sky += uSunTint * pow(max(0.0, cosSun), 1200.0) * 1.2;',
    '',
    '  // Reference colours for lighting the clouds and haze. These are',
    '  // constant across the frame, so the same integral is solved once',
    '  // on the CPU rather than a second and third time per pixel.',
    '  vec3 sunTint = uSunTint;',
    '  vec3 zenith  = uZenith;',
    '  float day = smoothstep(-0.16, 0.06, sun.y);',
    '',
    '  // Multiple scattering, which a single-scatter integral cannot',
    '  // produce on its own. It is why civil twilight is a deep blue',
    '  // rather than black, and why the sky does not snap off the',
    '  // instant the sun clears the horizon.',
    '  float twilight = (1.0 - day) * exp(-max(0.0, -sun.y) * 6.0);',
    '  sky += vec3(0.10, 0.155, 0.30) * twilight;',
    '',
    '  // ---- night: stars, moon, and the orange dome over the basin ----',
    '  float night = 1.0 - smoothstep(-0.34, -0.05, sun.y);',
    '  if (night > 0.001){',
    '    sky += vec3(0.55, 0.62, 0.95) * stars(rd) * night * 0.9;',
    '    sky += moonDisc(rd, normalize(uMoon), uMoonPhase, uMoonLimb) * night;',
    '    // moonlight wash',
    '    float ml = max(0.0, normalize(uMoon).y) * uMoonPhase * night;',
    '    sky += vec3(0.030, 0.042, 0.075) * ml * (0.5 + 0.5 * max(0.0, dot(rd, normalize(uMoon))));',
    '    // Los Angeles, ten million streetlights bouncing off the marine layer',
    '    float glow = exp(-max(0.0, rd.y) * 7.0) * night;',
    '    sky += vec3(0.135, 0.080, 0.042) * glow * (0.55 + 0.45 * uHaze + 0.6 * uCloud);',
    '    sky += vec3(0.018, 0.024, 0.045) * night;   // airglow floor',
    '  }',
    '',
    '  // ---- clouds ----',
    '  float t = uTime;',
    '  float drift = 0.004 + uWind * 0.0016;',
    '',
    '  vec3 lit    = mix(zenith * 1.35 + sunTint * 0.55, sunTint * 0.9 + zenith * 0.6, day);',
    '  vec3 shade  = mix(zenith * 0.55, zenith * 0.62 + sunTint * 0.04, day);',
    '  lit   = mix(vec3(0.055, 0.062, 0.085) + sunTint * 0.3, lit, day);',
    '  shade = mix(vec3(0.028, 0.032, 0.048), shade, day);',
    '  // a thick deck is grey, not blue: it scatters every wavelength',
    '  // equally, which is exactly what overcast light looks like',
    '  lit   = mix(lit,   vec3(dot(lit,   vec3(0.333))) * 1.03, uCloud * 0.45);',
    '  shade = mix(shade, vec3(dot(shade, vec3(0.333))) * 0.95, uCloud * 0.45);',
    '',
    '  // forward scattering: the silver lining when you look near the sun',
    '  float fwdScatter = pow(max(0.0, dot(rd, sun)), 12.0);',
    '',
    '  // high cirrus',
    '  vec4 hi = deck(rd, sun, 7200.0, 0.00016, 0.30 + uCloud * 0.42, 0.42, t, drift * 1.7);',
    '  // main deck',
    '  float lowCover = 0.16 + uCloud * 0.86 + uRain * 0.10;',
    '  vec4 lo = deck(rd, sun, 2100.0, 0.00042, lowCover, 0.34 - uCloud * 0.10, t, drift);',
    '',
    '  vec3 hiCol = mix(shade, lit, hi.x) * 1.06 + sunTint * fwdScatter * hi.x * 0.5;',
    '  sky = mix(sky, hiCol, clamp(hi.y * 0.55, 0.0, 1.0));',
    '',
    '  vec3 loCol = mix(shade, lit, lo.x);',
    '  loCol *= mix(1.0, 0.42, uRain);            // storm decks are dark',
    '  loCol += sunTint * fwdScatter * lo.x * 0.85;',
    '  sky = mix(sky, loCol, clamp(lo.y, 0.0, 1.0));',
    '',
    '  // ---- horizon haze / marine layer ----',
    '  vec3 hazeCol = mix(zenith * 0.9, sunTint * 0.55 + zenith * 0.75, 0.35);',
    '  hazeCol = mix(vec3(0.030, 0.034, 0.050), hazeCol, day);',
    '  hazeCol *= mix(1.0, 0.45, uRain);   // rain takes the light out of the air',
    '  float band = exp(-max(rd.y, 0.0) * (7.0 - uFog * 4.2));',
    '  sky = mix(sky, hazeCol, band * (0.20 + uHaze * 0.26 + uFog * 0.55));',
    '',
    '  // ---- below the horizon: the basin, seen through its own smog ----',
    '  // Derived from the haze colour rather than picked, so the land',
    '  // reads as continuous with the air sitting on top of it.',
    '  float ground = smoothstep(0.015, -0.14, rd.y);',
    '  vec3 groundCol = mix(hazeCol * 0.34, hazeCol * 0.52, day);',
    '  groundCol = mix(groundCol, vec3(0.024, 0.025, 0.034), 0.40);',
    '  // land falls away into shadow the further down you look',
    '  groundCol *= 1.0 - smoothstep(0.0, -0.34, rd.y) * 0.45;',
    '  if (night > 0.001){',
    '    // ten thousand blocks of streetlight, thinning as you look down',
    '    vec2 gp = rd.xz / max(-rd.y, 0.02);',
    '    float sparkle = smoothstep(0.88, 1.0, hash21(floor(gp * 110.0)));',
    '    groundCol += vec3(0.26, 0.14, 0.06) * sparkle * night * exp(-abs(rd.y) * 3.5);',
    '    groundCol += vec3(0.055, 0.032, 0.016) * night;',
    '  }',
    '  sky = mix(sky, groundCol, ground * 0.92);',
    '',
    '  // ---- rain ----',
    '  if (uRain > 0.01){',
    '    float r = rainStreaks(uv, t) * uRain;',
    '    vec3 wet = mix(sky, vec3(dot(sky, vec3(0.299, 0.587, 0.114))), 0.35 * uRain);',
    '    sky = mix(sky, wet, 0.8) * mix(1.0, 0.58, uRain);',
    '    sky += vec3(0.62, 0.67, 0.74) * r * 0.16 * (0.25 + day);',
    '  }',
    '',
    '  // ---- tone map ----',
    '  sky = 1.0 - exp(-1.6 * sky);',
    '  sky = pow(sky, vec3(1.0 / 1.1));',
    '',
    '  // gentle vignette so the type at the edges stays readable',
    '  float v = 1.0 - 0.14 * dot(uv, uv);',
    '  sky *= v;',
    '',
    '  // ---- put it through the press ----',
    '  float lum = dot(sky, vec3(0.299, 0.587, 0.114));',
    '  float dots = halftone(fc, lum, 0.4363, uDot);   // screen at 25 degrees',
    '  sky = mix(sky, sky * (0.80 + 0.34 * dots), uInk);',
    '',
    '  // paper grain, re-seeded a few times a second so it breathes',
    '  float grain = hash21(fc * 1.7 + floor(uTime * 9.0) * 91.7) - 0.5;',
    '  sky += grain * uGrain;',
    '',
    '  sky += (dither(fc) - 0.5) / 255.0;',
    '  gl_FragColor = vec4(sky, 1.0);',
    '}'
  ].join('\n');

  // ---------------------------------------------------------------
  // The same scattering integral, on the CPU
  // ---------------------------------------------------------------
  // Only needed for two fixed directions (toward the sun, and straight
  // up), and those don't vary across the screen. Solving them here once
  // per frame instead of once per pixel cuts the shader's work by two
  // thirds while giving bit-for-bit the same colours.

  var R_PLANET = 6371000, R_ATMOS = 6471000;
  var SH_RLH = 8000, SH_MIE = 1200, G_MIE = 0.758;
  var K_RLH = [5.8e-6, 13.5e-6, 33.1e-6];

  function rsiJS(ro, rd, sr) {
    var a = rd[0] * rd[0] + rd[1] * rd[1] + rd[2] * rd[2];
    var b = 2 * (rd[0] * ro[0] + rd[1] * ro[1] + rd[2] * ro[2]);
    var c = ro[0] * ro[0] + ro[1] * ro[1] + ro[2] * ro[2] - sr * sr;
    var d = b * b - 4 * a * c;
    if (d < 0) return [1e12, -1e12];
    d = Math.sqrt(d);
    return [(-b - d) / (2 * a), (-b + d) / (2 * a)];
  }

  function atmosphereJS(rd, ro, sun, intensity, kMie) {
    var I = 12, J = 6;
    var p = rsiJS(ro, rd, R_ATMOS);
    if (p[0] > p[1]) return [0, 0, 0];
    var g = rsiJS(ro, rd, R_PLANET);
    if (g[1] > 0 && g[0] > 0) p[1] = Math.min(p[1], g[0]);
    p[0] = Math.max(p[0], 0);
    var iStep = (p[1] - p[0]) / I;
    var iT = p[0];

    var totalR = [0, 0, 0], totalM = [0, 0, 0];
    var odR = 0, odM = 0;

    var mu = rd[0] * sun[0] + rd[1] * sun[1] + rd[2] * sun[2];
    var mumu = mu * mu, gg = G_MIE * G_MIE;
    var phaseR = 3 / (16 * Math.PI) * (1 + mumu);
    var phaseM = 3 / (8 * Math.PI) * ((1 - gg) * (mumu + 1)) /
                 (Math.pow(1 + gg - 2 * mu * G_MIE, 1.5) * (2 + gg));

    for (var i = 0; i < I; i++) {
      var s = iT + iStep * 0.5;
      var ix = ro[0] + rd[0] * s, iy = ro[1] + rd[1] * s, iz = ro[2] + rd[2] * s;
      var h = Math.sqrt(ix * ix + iy * iy + iz * iz) - R_PLANET;
      var dR = Math.exp(-h / SH_RLH) * iStep;
      var dM = Math.exp(-h / SH_MIE) * iStep;
      odR += dR; odM += dM;

      var jStep = rsiJS([ix, iy, iz], sun, R_ATMOS)[1] / J;
      var jT = 0, jOdR = 0, jOdM = 0;
      for (var j = 0; j < J; j++) {
        var t = jT + jStep * 0.5;
        var jx = ix + sun[0] * t, jy = iy + sun[1] * t, jz = iz + sun[2] * t;
        var jh = Math.sqrt(jx * jx + jy * jy + jz * jz) - R_PLANET;
        jOdR += Math.exp(-jh / SH_RLH) * jStep;
        jOdM += Math.exp(-jh / SH_MIE) * jStep;
        jT += jStep;
      }

      for (var c = 0; c < 3; c++) {
        var attn = Math.exp(-(kMie * (odM + jOdM) + K_RLH[c] * (odR + jOdR)));
        totalR[c] += dR * attn;
        totalM[c] += dM * attn;
      }
      iT += iStep;
    }

    return [
      intensity * (phaseR * K_RLH[0] * totalR[0] + phaseM * kMie * totalM[0]),
      intensity * (phaseR * K_RLH[1] * totalR[1] + phaseM * kMie * totalM[1]),
      intensity * (phaseR * K_RLH[2] * totalR[2] + phaseM * kMie * totalM[2])
    ];
  }

  function mieCoefficient() {
    return 21e-6 * (1 + weather.haze * 1.4 + weather.rain * 2.0 + weather.fog * 3.0);
  }

  // ---------------------------------------------------------------
  // Adaptive contrast
  // ---------------------------------------------------------------
  // The header has no background, so on a bright noon sky white type
  // disappears and on a night sky black type does. Rather than guess,
  // read the pixels actually sitting behind the type and switch.

  var contrastAt = 0;
  var strips = [
    { name: 'top', cls: 'sky-top--dark', from: 0.00, to: 0.11, dark: false },
    { name: 'bottom', cls: 'sky-bottom--dark', from: 0.86, to: 1.00, dark: false }
  ];

  function stripLuma(gl, w, h, from, to) {
    // gl_FragCoord has its origin at the bottom left, CSS at the top
    var y0 = Math.max(0, Math.floor(h * (1 - to)));
    var y1 = Math.min(h, Math.ceil(h * (1 - from)));
    var rows = Math.max(1, Math.min(3, y1 - y0));
    var buf = new Uint8Array(w * rows * 4);
    gl.readPixels(0, y0, w, rows, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    var sum = 0;
    // step across the strip rather than reading every pixel
    for (var i = 0; i < buf.length; i += 4 * 7) {
      sum += (0.299 * buf[i] + 0.587 * buf[i + 1] + 0.114 * buf[i + 2]) / 255;
    }
    return sum / Math.max(1, Math.floor(buf.length / (4 * 7)));
  }

  function sampleContrast(gl, w, h) {
    for (var i = 0; i < strips.length; i++) {
      var s = strips[i];
      var l;
      try { l = stripLuma(gl, w, h, s.from, s.to); } catch (e) { continue; }
      // hysteresis, so a drifting cloud edge cannot make the type flicker
      if (!s.dark && l > 0.60) s.dark = true;
      else if (s.dark && l < 0.48) s.dark = false;
      document.body.classList.toggle(s.cls, s.dark);
    }
  }

  // ---------------------------------------------------------------
  // Renderer
  // ---------------------------------------------------------------
  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  function start() {
    var mount = document.getElementById('sky');
    if (!mount) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'sky-canvas';
    mount.appendChild(canvas);

    var gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false })
          || canvas.getContext('experimental-webgl');
    if (!gl) { mount.classList.add('sky--fallback'); updateReadout(null); return; }

    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(prog));
      }
    } catch (e) {
      mount.classList.add('sky--fallback');
      updateReadout(null);
      return;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['uRes', 'uTime', 'uSun', 'uMoon', 'uMoonPhase', 'uMoonLimb',
     'uCloud', 'uRain', 'uFog', 'uHaze', 'uWind', 'uLook',
     'uSunTint', 'uZenith', 'uDot', 'uInk', 'uGrain'
    ].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

    // The sky is low-frequency, so rendering below device resolution
    // costs nothing visually and buys a lot of headroom.
    var scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.8;
    if (window.innerWidth < 760) scale *= 0.7;   // phones do the same work on a smaller GPU
    var w = 0, h = 0;

    function resize() {
      var rw = Math.max(1, Math.round(mount.clientWidth * scale));
      var rh = Math.max(1, Math.round(mount.clientHeight * scale));
      if (rw === w && rh === h) return;
      w = rw; h = rh;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    window.addEventListener('resize', resize);

    // gentle parallax on pointer move
    var targetYaw = VIEW_HEADING * RAD, targetPit = VIEW_PITCH * RAD;
    var yaw = targetYaw, pit = targetPit;
    window.addEventListener('pointermove', function (e) {
      var nx = (e.clientX / window.innerWidth) - 0.5;
      var ny = (e.clientY / window.innerHeight) - 0.5;
      targetYaw = VIEW_HEADING * RAD + nx * 0.24;
      targetPit = VIEW_PITCH * RAD - ny * 0.14;
    }, { passive: true });

    var reduced = window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var geo = skyGeometry(now());
    var geoAt = 0;
    var t0 = performance.now();
    var running = true;

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) { t0 = performance.now() - clock * 1000; requestAnimationFrame(frame); }
    });

    var clock = 0;

    function frame(ms) {
      if (!running) return;
      resize();
      clock = reduced ? 40 : (ms - t0) / 1000;

      // recompute the ephemeris once a minute, not every frame
      if (ms - geoAt > 60000) { geo = skyGeometry(now()); geoAt = ms; updateReadout(geo); }

      var sun = toVector(geo.sun.alt, geo.sun.az);
      var moon = toVector(geo.moon.alt, geo.moon.az);

      var ro = [0, R_PLANET + 400, 0];
      var kMie = mieCoefficient();
      var sunRay = [sun[0], sun[1] + 0.02, sun[2]];
      var m = Math.sqrt(sunRay[0] * sunRay[0] + sunRay[1] * sunRay[1] + sunRay[2] * sunRay[2]) || 1;
      sunRay = [sunRay[0] / m, sunRay[1] / m, sunRay[2] / m];
      var sunTint = atmosphereJS(sunRay, ro, sun, 22.0, kMie);
      var zenith = atmosphereJS([0, 1, 0], ro, sun, 22.0, kMie);

      yaw += (targetYaw - yaw) * 0.045;
      pit += (targetPit - pit) * 0.045;

      gl.uniform2f(U.uRes, w, h);
      gl.uniform1f(U.uTime, clock);
      gl.uniform3f(U.uSun, sun[0], sun[1], sun[2]);
      gl.uniform3f(U.uMoon, moon[0], moon[1], moon[2]);
      gl.uniform1f(U.uMoonPhase, geo.moonFraction);
      gl.uniform1f(U.uMoonLimb, geo.moonLimbAngle);
      gl.uniform1f(U.uCloud, weather.cloud);
      gl.uniform1f(U.uRain, weather.rain);
      gl.uniform1f(U.uFog, weather.fog);
      gl.uniform1f(U.uHaze, weather.haze);
      gl.uniform1f(U.uWind, weather.wind);
      gl.uniform2f(U.uLook, yaw, pit);
      gl.uniform3f(U.uSunTint, sunTint[0], sunTint[1], sunTint[2]);
      gl.uniform3f(U.uZenith, zenith[0], zenith[1], zenith[2]);
      gl.uniform1f(U.uDot, press.dot * scale);   // CSS px -> render px
      gl.uniform1f(U.uInk, press.ink);
      gl.uniform1f(U.uGrain, press.grain);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Sample what we just drew behind the type and flip it light or
      // dark to suit. readPixels stalls the pipeline, so this runs at
      // 3Hz rather than every frame.
      if (ms - contrastAt > 340) { contrastAt = ms; sampleContrast(gl, w, h); }

      // If the visitor asked for reduced motion, the sky is a still
      // image that only needs to catch up with the clock now and then.
      if (reduced) { setTimeout(function () { requestAnimationFrame(frame); }, 2000); }
      else { requestAnimationFrame(frame); }
    }

    resize();
    applyOverrides();
    updateReadout(geo);
    requestAnimationFrame(frame);

    // weather now, then every ten minutes
    fetchWeather().then(function () { applyOverrides(); updateReadout(geo); });
    setInterval(function () {
      fetchWeather().then(function () { applyOverrides(); updateReadout(skyGeometry(now())); });
    }, 600000);
  }

  // ---------------------------------------------------------------
  // Caption
  // ---------------------------------------------------------------
  function laTime() {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric', minute: '2-digit'
      }).format(now()).toLowerCase().replace(/\s/g, '');
    } catch (e) {
      return '';
    }
  }

  function updateReadout(geo) {
    var el = document.getElementById('sky-readout');
    if (!el) return;

    var parts = ['Los Angeles'];
    var time = laTime();
    if (time) parts.push(time);
    if (weather.tempF !== null) parts.push(weather.tempF + '°F');
    parts.push(weather.label);

    var sunLine = '';
    if (geo) {
      var alt = Math.round(geo.sun.alt / RAD);
      sunLine = alt > 0
        ? 'sun ' + alt + '° above the horizon'
        : 'sun ' + Math.abs(alt) + '° below the horizon · moon ' +
          Math.round(geo.moonFraction * 100) + '% lit';
    }

    el.innerHTML =
      '<span class="sky-readout__line">' + parts.join(' · ') + '</span>' +
      (sunLine ? '<span class="sky-readout__line sky-readout__line--dim">' + sunLine + '</span>' : '');
  }

  // tick the clock in the caption every 30s
  setInterval(function () { updateReadout(skyGeometry(now())); }, 30000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
