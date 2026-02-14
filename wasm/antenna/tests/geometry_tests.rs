use antenna::*;

#[test]
fn test_vec3_operations() {
    let a = Vec3::new(1.0, 2.0, 3.0);
    let b = Vec3::new(4.0, 5.0, 6.0);

    assert_eq!(a.dot(&b), 32.0);

    let c = a.sub(&b);
    assert_eq!(c.x, -3.0);
    assert_eq!(c.y, -3.0);
    assert_eq!(c.z, -3.0);
}

#[test]
fn test_intersect_sphere() {
    let ray = Ray::new(Vec3::new(0.0, 0.0, 0.0), Vec3::new(1.0, 0.0, 0.0));
    let sphere = Sphere::new(Vec3::new(5.0, 0.0, 0.0), 1.0);

    let result = intersect_sphere(&ray, &sphere);
    assert!(result.is_some());

    let (t1, t2) = result.unwrap();
    assert!(t1 > 0.0);
    assert!(t2 > t1);
}

#[test]
fn test_intersect_sphere_miss() {
    let ray = Ray::new(Vec3::new(0.0, 0.0, 0.0), Vec3::new(0.0, 1.0, 0.0));
    let sphere = Sphere::new(Vec3::new(5.0, 0.0, 0.0), 1.0);

    let result = intersect_sphere(&ray, &sphere);
    assert!(result.is_none());
}

#[test]
fn test_spherical_surface_generation() {
    let params = SphericalSurfaceParams::default();
    let vertex_count = ((params.segments_r + 1) * (params.segments_w + 1)) as usize;
    let index_count = (params.segments_r * params.segments_w * 6) as usize;

    let mut vertices = vec![0.0f32; vertex_count * 3];
    let mut uvs = vec![0.0f32; vertex_count * 2];
    let mut indices = vec![0u32; index_count];

    let result = generate_spherical_surface(&params, &mut vertices, &mut uvs, &mut indices);
    assert!(result > 0);

    // Verify first vertex is on sphere
    let r =
        (vertices[0] * vertices[0] + vertices[1] * vertices[1] + vertices[2] * vertices[2]).sqrt();
    assert!((r - params.radius as f32).abs() < 0.01);
}
