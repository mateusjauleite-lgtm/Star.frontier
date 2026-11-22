const SVG_NS = 'http://www.w3.org/2000/svg';
const DEFAULT_RANGE = 650;
const VIEW_SIZE = 320;
const CENTER = VIEW_SIZE / 2;
const RADAR_RADIUS = 136;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function resourceName(resourceId) {
  const id = String(resourceId || '').toLowerCase();
  if (id.includes('dilithium')) return 'DILÍTIO';
  if (id.includes('ore')) return 'MINÉRIO';
  const parts = id.split(/[.:/_-]+/).filter(Boolean);
  return (parts[parts.length - 1] || 'RECURSO').toUpperCase();
}

export function projectSensorContacts({
  telemetry,
  shipPosition,
  heading = 0,
  range = DEFAULT_RANGE
} = {}) {
  const operational = Boolean(telemetry?.operational);
  const contacts = Array.isArray(telemetry?.contacts) ? telemetry.contacts : [];
  const ship = shipPosition && [shipPosition.x, shipPosition.y, shipPosition.z].every(value => Number.isFinite(Number(value)))
    ? shipPosition
    : null;

  if (!operational || !ship) {
    return Object.freeze({
      available: false,
      status: operational ? 'POSIÇÃO DA NAVE INDISPONÍVEL' : telemetry?.enabled ? 'SENSORES SEM ENERGIA' : 'SENSORES DESLIGADOS',
      totalContacts: 0,
      outOfRange: 0,
      markers: []
    });
  }

  const yaw = finite(heading);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const radius = Math.max(1, finite(range, DEFAULT_RANGE));
  const markers = [];
  let outOfRange = 0;

  for (const contact of contacts) {
    const position = contact?.position;
    if (!position || ![position.x, position.y, position.z].every(value => Number.isFinite(Number(value)))) continue;
    const dx = Number(position.x) - Number(ship.x);
    const dz = Number(position.z) - Number(ship.z);
    const distance = Number.isFinite(Number(contact.distance)) ? Number(contact.distance) : Math.hypot(dx, dz);
    const deposits = Array.isArray(contact.resources) ? contact.resources.filter(item => finite(item?.amount) > 0) : [];
    const ore = Math.max(0, finite(contact.ore));
    if (ore <= 0 && deposits.length === 0) continue;
    if (distance > radius) { outOfRange++; continue; }

    // Converte o contato do mundo para a orientação local do piloto:
    // frente da nave fica no topo e estibordo fica à direita.
    const localRight = dx * cos - dz * sin;
    const localForward = -dx * sin - dz * cos;
    const scale = RADAR_RADIUS / radius;
    const resources = deposits.map(item => ({
      id: String(item.resourceId || 'resource.ore'),
      name: resourceName(item.resourceId),
      amount: finite(item.amount),
      purity: Number.isFinite(Number(item.purity)) ? finite(item.purity) : null
    }));

    markers.push(Object.freeze({
      id: String(contact.id || 'contact'),
      x: CENTER + localRight * scale,
      y: CENTER - localForward * scale,
      distance,
      ore,
      resources,
      label: resources.map(item => item.name).join(' · ') || 'MINÉRIO',
      hasDeposit: resources.length > 0
    }));
  }

  markers.sort((a, b) => a.distance - b.distance);
  return Object.freeze({
    available: true,
    status: markers.length ? markers.length + ' CONTATO(S) MINERAL(IS)' : 'NENHUM MINÉRIO NO ALCANCE',
    totalContacts: markers.length,
    outOfRange,
    markers
  });
}

function svgElement(documentRef, name, attributes = {}) {
  const element = documentRef.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function buildRadar(documentRef, projection) {
  const svg = svgElement(documentRef, 'svg', {
    viewBox: '0 0 320 320',
    class: 'sensor-radar-svg',
    role: 'img',
    'aria-label': 'Mapa tático dos contatos minerais detectados pelo defletor'
  });
  const add = (name, attrs) => svg.append(svgElement(documentRef, name, attrs));

  add('circle', { cx: CENTER, cy: CENTER, r: RADAR_RADIUS, class: 'sensor-radar-range' });
  for (const radius of [45, 90, 136]) {
    add('circle', { cx: CENTER, cy: CENTER, r: radius, class: 'sensor-radar-ring' });
  }
  add('path', { d: `M ${CENTER} 20 V 300 M 20 ${CENTER} H 300`, class: 'sensor-radar-axis' });
  add('path', { d: `M ${CENTER} ${CENTER - 13} L ${CENTER - 8} ${CENTER + 9} L ${CENTER} ${CENTER + 4} L ${CENTER + 8} ${CENTER + 9} Z`, class: 'sensor-radar-ship' });

  for (const marker of projection.markers) {
    const group = svgElement(documentRef, 'g', {
      class: marker.hasDeposit ? 'sensor-radar-contact has-deposit' : 'sensor-radar-contact',
      transform: `translate(${marker.x.toFixed(1)} ${marker.y.toFixed(1)})`
    });
    const title = svgElement(documentRef, 'title');
    title.textContent = marker.id + ' · ' + marker.label + ' · ' + marker.distance.toFixed(1) + ' u';
    group.append(title);
    group.append(svgElement(documentRef, 'circle', { r: marker.hasDeposit ? 5.5 : 3.5, class: 'sensor-radar-blip' }));
    if (marker.hasDeposit) {
      const label = svgElement(documentRef, 'text', { x: 8, y: 3, class: 'sensor-radar-label' });
      label.textContent = marker.label;
      group.append(label);
    }
    svg.append(group);
  }
  return svg;
}

export function createNavigationSensorMap({ roots = [], range = DEFAULT_RANGE, document: documentRef = globalThis.document } = {}) {
  const targets = [...roots].filter(Boolean);
  let lastProjection = null;

  function update(telemetry, shipPosition, heading = 0) {
    lastProjection = projectSensorContacts({ telemetry, shipPosition, heading, range });
    if (!documentRef?.createElementNS) return lastProjection;

    for (const root of targets) {
      const radar = buildRadar(documentRef, lastProjection);
      const status = documentRef.createElement('small');
      status.className = 'sensor-radar-status';
      status.textContent = lastProjection.status + (lastProjection.outOfRange ? ' · ' + lastProjection.outOfRange + ' FORA DO ALCANCE' : '');
      root.replaceChildren(radar, status);
      root.classList.toggle('sensor-map-online', lastProjection.available);
      root.dataset.sensorStatus = lastProjection.available ? 'online' : 'offline';
    }
    return lastProjection;
  }

  return Object.freeze({
    update,
    snapshot: () => lastProjection
  });
}
