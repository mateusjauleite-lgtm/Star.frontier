import * as THREE from 'three';
// Geometria modular do prato embutido; origem local no centro da abertura do Deck 3.
export function createDeflectorGeometry(options = {}) {
  const radius=Number(options.radius)||6.8, depth=Number(options.depth)||1.15;
  const group=new THREE.Group(); group.name='Frontier-Deflector-Assembly';
  const dark=new THREE.MeshStandardMaterial({color:0x142635,metalness:0.88,roughness:0.28});
  const trim=new THREE.MeshStandardMaterial({color:0x39728e,metalness:0.82,roughness:0.24,emissive:0x062b3c});
  const glow=new THREE.MeshBasicMaterial({color:0x31cfff});
  const dishMat=new THREE.MeshStandardMaterial({color:0x1b3e52,metalness:0.72,roughness:0.32,side:THREE.DoubleSide});
  const ring=(r,t,mat,name,z=0)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,12,96),mat);m.name=name;m.position.z=z;group.add(m);return m;};
  ring(radius,0.42,dark,'Deflector-Outer-Structural-Ring');
  ring(radius*0.88,0.16,trim,'Deflector-Emitter-Ring-Outer',-0.12);
  ring(radius*0.68,0.12,glow,'Deflector-Emitter-Ring-Inner',-0.2);
  const dish=new THREE.Mesh(new THREE.SphereGeometry(radius*0.68,64,32,0,Math.PI*2,0,Math.PI/2),dishMat);
  dish.name='Deflector-Recessed-Dish';dish.rotation.x=Math.PI;dish.scale.y=depth/radius;dish.position.z=-0.35;group.add(dish);
  const hub=new THREE.Mesh(new THREE.SphereGeometry(radius*0.16,32,20),glow);hub.name='Deflector-Central-Emitter';hub.position.z=-0.55;group.add(hub);
  for(let i=0;i<24;i++){const a=i*Math.PI/12;const seg=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.58,0.22),i%2?trim:glow);seg.name='Deflector-Segment-'+String(i+1).padStart(2,'0');seg.position.set(Math.cos(a)*radius*0.78,Math.sin(a)*radius*0.78,-0.18);seg.rotation.z=a;group.add(seg);}
  group.userData.setActive=active=>{glow.color.set(active?0x6beaff:0x1a7195);};
  return group;
}
