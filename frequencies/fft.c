// fft.c — WebAssembly core for the "frequencies" toy.
// Compiled freestanding (no libc, no libm); trig tables for the FFT twiddles
// are supplied by JS, everything else uses small local approximations.
//
// Data flow:
//   JS writes RGB image planes (floats 0..255)  ->  forward(n)  stores the
//   per-channel 2D FFT.  Each frame JS writes three edit maps (gain, add,
//   phase — all in fftshifted display coordinates) and calls render(n, addAmp),
//   which produces: edited-spectrum RGBA, phase RGBA, and the inverse-FFT
//   reconstruction RGBA.  Taking only the real part of the inverse keeps the
//   output valid even for non-conjugate-symmetric edits.

#define MAXN 512
#define EXPORT(name) __attribute__((export_name(name), used))

static float imgp[3][MAXN * MAXN];                     // input planes, 0..255
static float Fre[3][MAXN * MAXN], Fim[3][MAXN * MAXN]; // forward FFT (kept pristine)
static float Ere[MAXN * MAXN], Eim[MAXN * MAXN];       // edited spectrum, per-channel scratch
static float gainMap[MAXN * MAXN];                     // magnitude multiplier (shifted coords)
static float addMap[MAXN * MAXN];                      // additive magnitude, 0..1 (shifted coords)
static float phMap[MAXN * MAXN];                       // phase rotation, radians (shifted coords)
static float cosT[MAXN / 2], sinT[MAXN / 2];           // e^(2*pi*i*k/n) table, filled by JS
static unsigned char outRGBA[MAXN * MAXN * 4];         // reconstructed image
static unsigned char specRGBA[MAXN * MAXN * 4];        // log-magnitude display
static unsigned char phaseRGBA[MAXN * MAXN * 4];       // phase display
static unsigned short bitrev[MAXN];
static float colRe[MAXN], colIm[MAXN];                 // column FFT scratch
static float maxMag[3];

// ---- tiny math (freestanding: no libm) ----

static float fsin(float x) {
  const float PI = 3.14159265358979f, TWO_PI = 6.28318530717959f;
  x -= TWO_PI * __builtin_floorf(x * 0.15915494309f + 0.5f); // wrap to [-pi, pi]
  if (x > 1.57079632679f) x = PI - x;
  else if (x < -1.57079632679f) x = -PI - x;
  float x2 = x * x;
  return x * (1.0f + x2 * (-0.166666546f + x2 * (0.00833216076f + x2 * -0.000195152959f)));
}

static float fcos(float x) { return fsin(x + 1.57079632679f); }

static float fln(float x) { // natural log, x > 0; ~0.01 accuracy (display only)
  union { float f; unsigned u; } v = { x };
  int e = (int)(v.u >> 23) - 127;
  v.u = (v.u & 0x007FFFFFu) | 0x3F800000u;
  float m = v.f;
  float p = (-0.34484843f * m + 2.02466578f) * m - 1.67487759f;
  return ((float)e + p) * 0.69314718f;
}

static float fatan(float z) { // |z| <= 1
  float z2 = z * z;
  return z * (0.9998660f + z2 * (-0.3302995f + z2 * (0.1801410f + z2 * (-0.0851330f + 0.0208351f * z2))));
}

static float fatan2(float y, float x) {
  const float PI = 3.14159265359f, HPI = 1.57079632679f;
  float ax = x < 0 ? -x : x, ay = y < 0 ? -y : y;
  float r;
  if (ax >= ay) {
    if (ax == 0.0f) return 0.0f;
    r = fatan(ay / ax);
  } else {
    r = HPI - fatan(ax / ay);
  }
  if (x < 0) r = PI - r;
  return y < 0 ? -r : r;
}

// ---- FFT ----

static void fft1d(float *re, float *im, int n, int dir) {
  for (int i = 0; i < n; i++) {
    int j = bitrev[i];
    if (j > i) {
      float t;
      t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (int len = 2; len <= n; len <<= 1) {
    int half = len >> 1, step = n / len;
    for (int i = 0; i < n; i += len) {
      for (int j = 0; j < half; j++) {
        int t = j * step;
        float wr = cosT[t];
        float wi = dir > 0 ? -sinT[t] : sinT[t];
        float xr = re[i + j + half], xi = im[i + j + half];
        float tr = xr * wr - xi * wi, ti = xr * wi + xi * wr;
        re[i + j + half] = re[i + j] - tr;
        im[i + j + half] = im[i + j] - ti;
        re[i + j] += tr;
        im[i + j] += ti;
      }
    }
  }
  if (dir < 0) {
    float inv = 1.0f / (float)n;
    for (int i = 0; i < n; i++) { re[i] *= inv; im[i] *= inv; }
  }
}

static void fft2d(float *re, float *im, int n, int dir) {
  for (int y = 0; y < n; y++) fft1d(re + y * n, im + y * n, n, dir);
  for (int x = 0; x < n; x++) {
    for (int y = 0; y < n; y++) { colRe[y] = re[y * n + x]; colIm[y] = im[y * n + x]; }
    fft1d(colRe, colIm, n, dir);
    for (int y = 0; y < n; y++) { re[y * n + x] = colRe[y]; im[y * n + x] = colIm[y]; }
  }
}

// ---- exports ----

EXPORT("addr_img")   float *addr_img(int c) { return imgp[c]; }
EXPORT("addr_gain")  float *addr_gain(void) { return gainMap; }
EXPORT("addr_add")   float *addr_add(void)  { return addMap; }
EXPORT("addr_ph")    float *addr_ph(void)   { return phMap; }
EXPORT("addr_cos")   float *addr_cos(void)  { return cosT; }
EXPORT("addr_sin")   float *addr_sin(void)  { return sinT; }
EXPORT("addr_out")   unsigned char *addr_out(void)   { return outRGBA; }
EXPORT("addr_spec")  unsigned char *addr_spec(void)  { return specRGBA; }
EXPORT("addr_phase") unsigned char *addr_phase(void) { return phaseRGBA; }

EXPORT("set_size")
void set_size(int n) {
  bitrev[0] = 0;
  for (int i = 1; i < n; i++)
    bitrev[i] = (unsigned short)((bitrev[i >> 1] >> 1) | ((i & 1) ? (n >> 1) : 0));
  for (int i = 0; i < n * n; i++) {
    outRGBA[i * 4 + 3] = 255;
    specRGBA[i * 4 + 3] = 255;
    phaseRGBA[i * 4 + 3] = 255;
  }
}

EXPORT("forward")
void forward(int n) {
  for (int c = 0; c < 3; c++) {
    for (int i = 0; i < n * n; i++) { Fre[c][i] = imgp[c][i]; Fim[c][i] = 0.0f; }
    fft2d(Fre[c], Fim[c], n, 1);
    float mx = 0.0f;
    for (int i = 0; i < n * n; i++) {
      float m = Fre[c][i] * Fre[c][i] + Fim[c][i] * Fim[c][i];
      if (m > mx) mx = m;
    }
    maxMag[c] = __builtin_sqrtf(mx);
  }
}

// addAmp: additive-magnitude scale in spectrum units (JS passes strength*128*n*n
// so a full-alpha stamped bin reconstructs to a ~128-level grating).
EXPORT("render")
void render(int n, float addAmp) {
  int h = n >> 1, nn = n * n;
  float gmax = maxMag[0];
  if (maxMag[1] > gmax) gmax = maxMag[1];
  if (maxMag[2] > gmax) gmax = maxMag[2];
  float lscale = 255.0f / fln(1.0f + gmax);

  for (int c = 0; c < 3; c++) {
    for (int v = 0; v < n; v++) {
      int sv = ((v + h) & (n - 1)) * n;
      for (int u = 0; u < n; u++) {
        int idx = v * n + u;
        int didx = sv + ((u + h) & (n - 1)); // fftshifted position of this bin
        float re = Fre[c][idx], im = Fim[c][idx];
        float g = gainMap[didx];
        re *= g; im *= g;
        float p = phMap[didx];
        if (p != 0.0f) {
          float cr = fcos(p), sr = fsin(p);
          float r2 = re * cr - im * sr;
          im = re * sr + im * cr;
          re = r2;
        }
        float a = addMap[didx];
        if (a != 0.0f) re += a * addAmp;
        Ere[idx] = re;
        Eim[idx] = im;

        float mag = __builtin_sqrtf(re * re + im * im);
        float L = fln(1.0f + mag) * lscale;
        specRGBA[didx * 4 + c] = L > 255.0f ? 255 : (unsigned char)L;
        float ph = (fatan2(im, re) + 3.14159265f) * 40.5845f; // -> 0..255
        phaseRGBA[didx * 4 + c] = ph > 255.0f ? 255 : (unsigned char)ph;
      }
    }
    fft2d(Ere, Eim, n, -1);
    for (int i = 0; i < nn; i++) {
      float x = Ere[i]; // real part only
      outRGBA[i * 4 + c] = x <= 0.0f ? 0 : (x >= 255.0f ? 255 : (unsigned char)x);
    }
  }
}
