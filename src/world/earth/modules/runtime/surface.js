import * as THREE from 'three';

export const EARTH_LAND_POLYGONS = [
  // América do Norte (incluindo Alasca e Canadá)
  [[-168,65],[-164,60],[-153,58],[-145,60],[-139,59],[-135,56],[-130,54],[-128,50],[-124,48],[-123,42],[-117,32],[-111,31],[-106,31],[-103,28],[-97,25],[-97,19],[-91,18],[-87,21],[-84,25],[-81,25],[-80,30],[-77,34],[-75,38],[-71,41],[-69,44],[-65,45],[-61,49],[-59,53],[-62,57],[-66,60],[-72,63],[-76,67],[-83,70],[-91,72],[-101,74],[-112,74],[-122,72],[-130,70],[-140,69],[-151,70],[-160,70]],
  // América Central
  [[-92,18],[-88,17],[-86,15],[-84,11],[-82,9],[-79,9],[-77,7],[-80,13],[-83,16],[-87,18]],
  // América do Sul
  [[-81,12],[-77,8],[-73,10],[-70,11],[-66,10],[-62,9],[-58,6],[-53,4],[-50,1],[-48,-5],[-44,-3],[-41,-9],[-36,-11],[-38,-17],[-42,-22],[-48,-27],[-50,-32],[-54,-35],[-58,-38],[-62,-42],[-66,-50],[-69,-55],[-73,-51],[-75,-44],[-73,-35],[-77,-27],[-78,-18],[-80,-8]],
  // Europa e Ásia (Eurásia)
  [[-10,36],[-9,43],[-5,48],[2,51],[8,54],[14,55],[20,60],[28,60],[35,66],[45,68],[55,65],[65,68],[75,72],[90,73],[105,70],[120,66],[135,60],[150,59],[163,62],[178,55],[170,48],[160,45],[150,42],[143,38],[137,34],[130,31],[125,25],[120,20],[115,15],[110,10],[105,5],[100,8],[95,15],[90,21],[85,22],[80,8],[75,10],[70,20],[65,25],[58,27],[52,33],[48,39],[42,42],[36,40],[30,37],[25,40],[20,39],[15,42],[10,44],[5,43],[0,40],[-5,40]],
  // África
  [[-17,35],[0,37],[10,37],[25,32],[33,30],[35,22],[43,12],[51,11],[49,2],[43,-2],[41,-12],[35,-22],[32,-29],[25,-34],[18,-35],[12,-28],[10,-17],[5,-5],[-1,5],[-8,12],[-15,20],[-17,29]],
  // Península Arábica
  [[35,31],[43,30],[50,25],[56,20],[52,15],[45,12],[42,17],[38,22]],
  // Índia
  [[68,24],[72,29],[78,31],[85,26],[89,21],[86,15],[81,8],[77,7],[73,14]],
  // Sudeste Asiático continental
  [[92,22],[100,20],[107,17],[109,12],[106,8],[102,5],[98,8],[95,14]],
  // Indonésia e ilhas principais
  [[95,5],[105,4],[114,-3],[121,-5],[130,-4],[135,-7],[128,-9],[118,-8],[110,-7],[104,-5]],
  // Japão
  [[130,32],[132,35],[136,38],[140,41],[144,44],[146,41],[142,36],[138,33],[134,31]],
  // Austrália
  [[113,-11],[117,-14],[123,-16],[128,-14],[133,-12],[137,-13],[142,-11],[146,-16],[151,-24],[153,-29],[149,-36],[144,-39],[137,-36],[130,-34],[124,-32],[118,-29],[114,-23]],
  // Groenlândia
  [[-52,83],[-42,82],[-28,78],[-22,72],[-30,65],[-38,60],[-48,59],[-55,63],[-60,70],[-58,77]],
  // Madagascar
  [[49,-12],[50,-16],[49,-21],[46,-25],[44,-19]],
  // Reino Unido e Irlanda
  [[-10,55],[-8,58],[-5,59],[-3,57],[-2,53],[-5,50],[-8,52]],
  [[-10,51],[-7,52],[-6,55],[-8,55]],
  // Nova Zelândia
  [[172,-34],[176,-38],[178,-42],[174,-46],[168,-44],[166,-40]],
  [[173,-41],[176,-43],[170,-47],[167,-46]],
  // Antártida, representada como continente e não apenas uma faixa de gelo.
  [[-180,-70],[-160,-68],[-140,-70],[-120,-73],[-100,-72],[-80,-75],[-60,-74],[-40,-70],[-20,-72],[0,-75],[20,-73],[40,-70],[60,-72],[80,-74],[100,-72],[120,-70],[140,-68],[160,-70],[180,-72],[180,-90],[-180,-90]]
];

function traceLand(ctx, width, height) {
  ctx.beginPath();
  for (const polygon of EARTH_LAND_POLYGONS) {
    polygon.forEach(([lon, lat], index) => {
      const x = (lon + 180) / 360 * width;
      const y = (90 - lat) / 180 * height;
      index ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
  }
}

export function createEarthLandMask(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  traceLand(ctx, width, height);
  ctx.fill();
  return canvas;
}

// Match the packaged NOAA ETOPO 0.25-degree grid across the entire globe.
// A single global mesh avoids waiting for the ship to approach before relief appears.
export const EARTH_GLOBAL_SURFACE_SEGMENTS = Object.freeze({ width: 360, height: 180 });

// Progressive geometry budgets: the globe starts with a lightweight mesh,
// then increases detail only when the camera approaches. Local ETOPO patches
// remain independent and continue to use the authoritative collision sampler.
export const EARTH_LOD_SEGMENTS = Object.freeze([
  Object.freeze({ width: 144, height: 72 }),
  Object.freeze({ width: 216, height: 108 }),
  Object.freeze({ width: 360, height: 180 }),
  Object.freeze({ width: 540, height: 270 })
]);

export function selectEarthLodLevel(distance, radius, currentLevel = null) {
  if (!Number.isFinite(distance) || !Number.isFinite(radius) || radius <= 0) return 3;
  const thresholds = [4.2, 2.2, 1.35];
  if (!Number.isInteger(currentLevel) || currentLevel < 0 || currentLevel > 3) {
    return distance > radius * thresholds[0] ? 0
      : distance > radius * thresholds[1] ? 1
      : distance > radius * thresholds[2] ? 2 : 3;
  }
  // Hysteresis prevents rapid LOD toggling when the camera sits on a boundary.
  if (currentLevel < 3 && distance < radius * thresholds[currentLevel] * 0.92) {
    return currentLevel + 1;
  }
  if (currentLevel > 0 && distance > radius * thresholds[currentLevel - 1] * 1.08) {
    return currentLevel - 1;
  }
  return currentLevel;
}
