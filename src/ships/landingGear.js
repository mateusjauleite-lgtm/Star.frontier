import * as THREE from 'three';

function addRod(parent, start, end, radius, material, name, segments = 12) {
  const a = new THREE.Vector3(...start);
  const b = new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), segments),
    material
  );
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

function addHinge(parent, position, radius, material, name) {
  const hinge = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 12, 10),
    material
  );
  hinge.name = name;
  hinge.position.set(...position);
  parent.add(hinge);
  return hinge;
}

/**
 * Four compact, articulated wheel assemblies based on the supplied reference.
 * Contact anchors are authored at the bottom of each tire, in ship-visual space.
 */
export function createLandingGear(THREERef = THREE) {
  const group = new THREERef.Group();
  group.name = 'Four-Point-Articulated-Wheel-Gear';

  const frameMaterial = new THREERef.MeshStandardMaterial({
    color: 0xd8e2e9, metalness: 0.78, roughness: 0.3
  });
  const pistonMaterial = new THREERef.MeshStandardMaterial({
    color: 0x8297a5, metalness: 0.9, roughness: 0.22
  });
  const jointMaterial = new THREERef.MeshStandardMaterial({
    color: 0x263b4c, metalness: 0.82, roughness: 0.34
  });
  const tireMaterial = new THREERef.MeshStandardMaterial({
    color: 0x171b20, metalness: 0.08, roughness: 0.88
  });
  const rimMaterial = new THREERef.MeshStandardMaterial({
    color: 0x9eafba, metalness: 0.88, roughness: 0.24
  });
  const accentMaterial = new THREERef.MeshStandardMaterial({
    color: 0x278bb5, metalness: 0.68, roughness: 0.3
  });

  const contactPoints = [];
  const pivots = [];
  const doors = [];
  const assemblyPositions = [];
  for (const side of [-1, 1]) {
    for (const fore of [-1, 1]) {
      const x = side * 15.5;
      const z = fore * 25.5;
      const assembly = new THREERef.Group();
      assembly.name = `Articulated-Wheel-Gear-${side < 0 ? 'Port' : 'Starboard'}-${fore < 0 ? 'Fore' : 'Aft'}`;
      const pivot = new THREERef.Group();
      pivot.name = `Landing-Gear-Retract-Pivot-${side}-${fore}`;
      pivot.position.set(x, -10.8, z);
      group.add(pivot);
      pivots.push({ pivot, foldDirection: fore < 0 ? -1 : 1 });
      assembly.position.set(0, 10.8, 0);
      pivot.add(assembly);
      assemblyPositions.push({ x, z });

      // Compact upper mounting bracket, fixed to the lower structural frame.
      const mount = new THREERef.Mesh(
        new THREERef.BoxGeometry(5.2, 0.9, 3.1),
        jointMaterial
      );
      mount.name = 'Gear-Upper-Mount';
      mount.position.set(0, -10.8, 0);
      assembly.add(mount);
      for (const lugX of [-1.75, 1.75]) {
        addHinge(assembly, [lugX, -11.25, 0], 0.72, frameMaterial, 'Gear-Mount-Hinge');
      }

      // Main oleo strut: outer sleeve and exposed sliding piston.
      addRod(assembly, [0, -11.35, 0], [0, -20.4, 0], 1.0, frameMaterial, 'Gear-Oleo-Outer');
      addRod(assembly, [0, -16.1, 0], [0, -21.45, 0], 0.48, pistonMaterial, 'Gear-Oleo-Piston');
      const collar = new THREERef.Mesh(
        new THREERef.CylinderGeometry(1.18, 1.18, 0.72, 16),
        accentMaterial
      );
      collar.name = 'Gear-Oleo-Collar';
      collar.position.set(0, -16.0, 0);
      assembly.add(collar);

      // Side articulated brace and its short hydraulic damper.
      addHinge(assembly, [0, -14.9, 0], 0.72, jointMaterial, 'Gear-Brace-Upper-Hinge');
      addRod(assembly, [0.55, -15.0, 0], [3.65, -20.7, 0], 0.34, frameMaterial, 'Gear-Side-Brace');
      addRod(assembly, [1.65, -17.0, 0], [3.55, -20.45, 0], 0.19, accentMaterial, 'Gear-Brace-Hydraulic-Rod');
      addHinge(assembly, [3.65, -20.7, 0], 0.58, jointMaterial, 'Gear-Brace-Lower-Hinge');
      addRod(assembly, [3.65, -20.7, 0], [0, -22.35, 0], 0.28, frameMaterial, 'Gear-Lower-Triangulation');

      // Fork arms straddle the tire and meet the wheel axle.
      for (const forkSide of [-1, 1]) {
        addRod(
          assembly,
          [forkSide * 1.05, -20.6, 0],
          [forkSide * 1.05, -23.05, 0],
          0.42,
          frameMaterial,
          'Gear-Wheel-Fork'
        );
        addHinge(assembly, [forkSide * 1.05, -23.05, 0], 0.48, jointMaterial, 'Gear-Axle-Hinge');
      }

      const tire = new THREERef.Mesh(
        new THREERef.CylinderGeometry(2.65, 2.65, 1.55, 28),
        tireMaterial
      );
      tire.name = 'Gear-Wheel-Tire';
      tire.rotation.z = Math.PI / 2;
      tire.position.set(0, -23.05, 0);
      assembly.add(tire);

      const rim = new THREERef.Mesh(
        new THREERef.CylinderGeometry(1.62, 1.62, 1.64, 24),
        rimMaterial
      );
      rim.name = 'Gear-Wheel-Rim';
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(tire.position);
      assembly.add(rim);

      for (const hubSide of [-1, 1]) {
        const hub = new THREERef.Mesh(
          new THREERef.CylinderGeometry(0.62, 0.62, 0.16, 16),
          jointMaterial
        );
        hub.name = 'Gear-Wheel-Axle-Hub';
        hub.rotation.z = Math.PI / 2;
        hub.position.set(hubSide * 0.84, tire.position.y, tire.position.z);
        assembly.add(hub);
      }

      const contact = {
        id: `gear-${side < 0 ? 'port' : 'starboard'}-${fore < 0 ? 'fore' : 'aft'}`,
        get point() {
          group.updateWorldMatrix(true, true);
          const worldPoint = pivot.localToWorld(new THREERef.Vector3(0, -14.92, 0));
          return group.worldToLocal(worldPoint);
        }
      };
      contactPoints.push(contact);

      const doorPivot = new THREERef.Group();
      doorPivot.name = 'Landing-Gear-Bay-Door-Pivot';
      doorPivot.position.set(x, -14.8, z);
      group.add(doorPivot);
      const door = new THREERef.Mesh(
        new THREERef.BoxGeometry(7.2, 0.28, 10.2),
        undersideMaterial
      );
      door.name = 'Landing-Gear-Bay-Door';
      door.position.set(0, 0, fore * -5.1);
      doorPivot.add(door);
      doors.push({ doorPivot, foldDirection: fore < 0 ? -1 : 1 });
    }
  }

  let deployment = 1;
  const setDeployment = value => {
    deployment = THREERef.MathUtils.clamp(Number(value) || 0, 0, 1);
    for (const { pivot, foldDirection } of pivots) {
      pivot.rotation.x = foldDirection * (1 - deployment) * Math.PI * 0.5;
    }
    for (const { doorPivot, foldDirection } of doors) {
      doorPivot.rotation.x = -foldDirection * deployment * 0.72;
    }
    return deployment;
  };
  setDeployment(1);
  group.userData.setDeployment = setDeployment;
  group.userData.getDeployment = () => deployment;

  return { group, contactPoints, assemblyPositions, setDeployment, getDeployment: () => deployment };
}
