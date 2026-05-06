// frontend/src/components/PlaceSearch.jsx
import React, { useState } from 'react';
import { twoGisApi } from '../services/2gisApi';
import PlaceCard from './PlaceCard';
import './PlaceSearch.css';

const CATEGORIES = [
  { id: 'food', name: '🍽️ Еда', icon: '🍴' },
  { id: 'fuel', name: '⛽ Заправки', icon: '⛽' },
  { id: 'supermarket', name: '🛒 Супермаркеты', icon: '🛒' },
  { id: 'attraction', name: '🏛️ Достопримечательности', icon: '🏛️' },
  { id: 'park', name: '🌳 Природа', icon: '🌳' }
];

function PlaceSearch({ onAddToRoute, currentRoutePlaces = [], centerPoint }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !centerPoint) return;

    setLoading(true);
    const results = await twoGisApi.searchPlace(searchQuery, centerPoint);
    setSearchResults(results);
    setLoading(false);
  };

  const handleCategoryClick = async (categoryId) => {
    if (!centerPoint) return;
    
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
    setLoading(true);
    
    if (categoryId) {
      const results = await twoGisApi.searchByCategory(categoryId, centerPoint);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
    setLoading(false);
  };

  const isInRoute = (place) => {
    return currentRoutePlaces.some(p => 
      p.name === place.name && Math.abs(p.lat - place.point.lat) < 0.001
    );
  };

  return (
    <div className="place-search">
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск места (например, Эрмитаж)"
          className="search-input"
        />
        <button type="submit" className="search-btn" disabled={loading}>
          {loading ? '🔍 Поиск...' : '🔍'}
        </button>
      </form>

      <div className="categories">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => handleCategoryClick(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {searchResults.length > 0 && (
        <div className="search-results">
          <h3>Найдено мест: {searchResults.length}</h3>
          {searchResults.map((place, index) => (
            <PlaceCard
              key={place.id || index}
              place={{
                id_2gis: place.id,
                name: place.name,
                lat: place.point.lat,
                lng: place.point.lng,
                category: selectedCategory
              }}
              onAddToRoute={onAddToRoute}
              isInRoute={isInRoute(place)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default PlaceSearch;
