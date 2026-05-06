// frontend/src/services/2gisApi.js
const API_KEY = import.meta.env.VITE_2GIS_API_KEY;
const BASE_URL = 'https://catalog.api.2gis.com/3.0/items';

export const twoGisApi = {
  // Поиск места по названию и координатам
  async searchPlace(query, point, radius = 1000) {
    try {
      const response = await fetch(
        `${BASE_URL}?key=${API_KEY}&q=${encodeURIComponent(query)}&point=${point.lng},${point.lat}&radius=${radius}&fields=items.address,items.reviews_count,items.rating,items.photos,items.work_hours`
      );
      const data = await response.json();
      return data.result.items || [];
    } catch (error) {
      console.error('Ошибка 2GIS API:', error);
      return [];
    }
  },

  // Получение детальной информации о месте
  async getPlaceDetails(id) {
    try {
      const response = await fetch(
        `${BASE_URL}/${id}?key=${API_KEY}&fields=items.address,items.reviews_count,items.rating,items.photos,items.work_hours,items.phone,items.website`
      );
      const data = await response.json();
      return data.result.item || null;
    } catch (error) {
      console.error('Ошибка получения деталей:', error);
      return null;
    }
  },

  // Поиск по категориям
  async searchByCategory(category, point, radius = 5000) {
    const categoryMap = {
      'food': 'restaurant',
      'заправки': 'fuel',
      'супермаркеты': 'supermarket',
      'достопримечательности': 'attraction',
      'природа': 'park'
    };
    
    const rubric = categoryMap[category.toLowerCase()] || category;
    return this.searchPlace(rubric, point, radius);
  }
};

export default twoGisApi;
