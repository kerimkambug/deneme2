import L from 'leaflet';

/** Anahtarsız altlık: önce OpenStreetMap, sürekli hata verirse yedek sağlayıcı */
export function addBaseLayer(map: L.Map) {
  const sources = [
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap', subdomains: 'abc' },
    { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', attribution: '&copy; OpenStreetMap, HOT', subdomains: 'abc' },
  ];
  let idx = 0;
  let errors = 0;
  let layer: L.TileLayer;
  const onErr = () => {
    errors += 1;
    if (errors < 4 || idx >= sources.length - 1) return;
    idx += 1;
    errors = 0;
    map.removeLayer(layer);
    add();
  };
  const add = () => {
    const s = sources[idx];
    layer = L.tileLayer(s.url, { maxZoom: 19, attribution: s.attribution, subdomains: s.subdomains }).addTo(map);
    layer.on('tileerror', onErr);
  };
  add();
}
