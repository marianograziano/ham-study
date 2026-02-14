use num_complex::Complex64;
pub use std::f64::consts::PI;

// Constants from nec2c.h
pub const CVEL: f64 = 299.8;
pub const PI8: f64 = 25.13274123;
pub const PI10: f64 = 31.41592654;
pub const TA: f64 = 1.745329252E-02; // Degrees to radians
pub const TD: f64 = 57.29577951; // Radians to degrees
pub const ETA: f64 = 376.73;
pub const RETA: f64 = 2.654420938E-3;
pub const TP: f64 = 6.283185308;
pub const PCHCON: usize = 100000;
pub const SMIN: f64 = 1.0e-3;

// Structs encapsulating global ("common") variables

// common /data/ (geometry data)
#[derive(Debug, Default, Clone)]
pub struct GeometryData {
    pub n: usize,    // Number of wire segments
    pub np: usize,   // Number of wire segments in symmetry cell
    pub m: usize,    // Number of surface patches
    pub mp: usize,   // Number of surface patches in symmetry cell
    pub npm: usize,  // = n+m
    pub np2m: usize, // = n+2m
    pub np3m: usize, // = n+3m
    pub ipsym: i32,  // Symmetry flag

    pub icon1: Vec<i32>, // Segments end 1 connection
    pub icon2: Vec<i32>, // Segments end 2 connection
    pub itag: Vec<i32>,  // Segments tag number

    // Wire segment data
    pub x1: Vec<f64>,
    pub y1: Vec<f64>,
    pub z1: Vec<f64>, // End 1 coordinates
    pub x2: Vec<f64>,
    pub y2: Vec<f64>,
    pub z2: Vec<f64>, // End 2 coordinates
    pub x: Vec<f64>,
    pub y: Vec<f64>,
    pub z: Vec<f64>,    // Segment centers
    pub si: Vec<f64>,   // Length
    pub bi: Vec<f64>,   // Radius
    pub cab: Vec<f64>,  // cos(a)*cos(b)
    pub sab: Vec<f64>,  // cos(a)*sin(b)
    pub salp: Vec<f64>, // Z component - sin(a)

    // Surface patch data (not primarily using patches for Yagi, but keeping for completeness if needed)
    pub px: Vec<f64>,
    pub py: Vec<f64>,
    pub pz: Vec<f64>,
    pub t1x: Vec<f64>,
    pub t1y: Vec<f64>,
    pub t1z: Vec<f64>,
    pub t2x: Vec<f64>,
    pub t2y: Vec<f64>,
    pub t2z: Vec<f64>,
    pub pbi: Vec<f64>,
    pub psalp: Vec<f64>,

    pub wlam: f64, // Wavelength in meters
}

impl GeometryData {
    pub fn new() -> Self {
        Self::default()
    }
}

// common /crnt/
#[derive(Debug, Default, Clone)]
pub struct CurrentData {
    pub air: Vec<f64>, // Ai/lambda, real part
    pub aii: Vec<f64>, // Ai/lambda, imaginary part
    pub bir: Vec<f64>, // Bi/lambda, real part
    pub bii: Vec<f64>, // Bi/lambda, imaginary part
    pub cir: Vec<f64>, // Ci/lambda, real part
    pub cii: Vec<f64>, // Ci/lambda, imaginary part

    pub cur: Vec<Complex64>, // Amplitude of basis function
}

// common /segj/
#[derive(Debug, Default, Clone)]
pub struct SegjData {
    pub jco: Vec<i32>, // Stores connection data
    pub jsno: usize,   // Total number of entries in ax, bx, cx
    pub maxcon: usize, // Max. no. connections

    pub ax: Vec<f64>,
    pub bx: Vec<f64>,
    pub cx: Vec<f64>,
}

// The main Context struct to hold everything
#[derive(Debug, Default)]
pub struct Context {
    pub geometry: GeometryData,
    pub current: CurrentData,
    pub segj: SegjData,
    // Add other structs as we port them
    // pub gnd: GroundData,
    // pub netcx: NetcxData,
    // pub fpat: FpatData,
    // pub zload: ZloadData,
}

impl Context {
    pub fn new() -> Self {
        Self::default()
    }
}
