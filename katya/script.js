const API_KEY = '5c6c1fbc-28a6-4da1-b40c-4786df60f98c';

const map = new mapgl.Map('map', {
  center: [37.6173, 55.7558], // Москва: [долгота, широта]
  zoom: 12,
  key: API_KEY,
});

const directions = new mapgl.Directions(map, {
  directionsApiKey: API_KEY,
});

let points = [];
let markers = [];

const pointsList = document.getElementById('pointsList');
const buildRouteBtn = document.getElementById('buildRouteBtn');
const clearBtn = document.getElementById('clearBtn');

map.on('click', (event) => {
  const coordinates = event.lngLat;

  points.push(coordinates);

  const marker = new mapgl.Marker(map, {
    coordinates: coordinates,
    label: {
      text: String(points.length),
    },
  });

  markers.push(marker);
  renderPointsList();
});

function renderPointsList() {
  pointsList.innerHTML = '';

  points.forEach((point, index) => {
    const li = document.createElement('li');
    li.textContent = `Точка ${index + 1}: ${point[1].toFixed(5)}, ${point[0].toFixed(5)}`;
    pointsList.appendChild(li);
  });
}

buildRouteBtn.addEventListener('click', () => {
  if (points.length < 2) {
    alert('Нужно выбрать минимум 2 точки');
    return;
  }

  if (points.length > 10) {
    alert('Directions plugin поддерживает маршрут до 10 точек');
    return;
  }

  directions.clear();

  directions.carRoute({
    points: points,
  });
});

clearBtn.addEventListener('click', () => {
  points = [];

  markers.forEach((marker) => marker.destroy());
  markers = [];

  directions.clear();
  renderPointsList();
});
