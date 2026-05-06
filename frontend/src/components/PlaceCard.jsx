// frontend/src/components/PlaceCard.jsx
import React, { useState, useEffect } from 'react';
import { twoGisApi } from '../services/2gisApi';
import './PlaceCard.css';

function PlaceCard({ place, onAddToRoute, isInRoute = false }) {
  const [placeData, setPlaceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPlaceData() {
      if (place.id_2gis) {
        const data = await twoGisApi.getPlaceDetails(place.id_2gis);
        if (data) {
          setPlaceData(data);
        } else {
          // Если нет данных из 2GIS, используем базовые
          setPlaceData(place);
        }
      } else {
        setPlaceData(place);
      }
      setLoading(false);
    }
    loadPlaceData();
  }, [place]);

  if (loading) {
    return (
      <div className="place-card loading">
        <div className="place-card__skeleton">Загрузка...</div>
      </div>
    );
  }

  if (!placeData) {
    return <div className="place-card error">Место не найдено</div>;
  }

  const mainPhoto = placeData.photos?.[0]?.url || 'https://placehold.co/400x300';
  const rating = placeData.rating || 0;
  const reviewsCount = placeData.reviews_count || 0;

  return (
    <div className="place-card" style={getCardStyle(place.category)}>
      <div className="place-card__image">
        <img src={mainPhoto} alt={placeData.name} />
        {rating > 0 && (
          <div className="place-card__rating">
            ⭐ {rating} ({reviewsCount})
          </div>
        )}
      </div>
      
      <div className="place-card__content">
        <h3 className="place-card__title">{placeData.name}</h3>
        
        {placeData.address && (
          <p className="place-card__address">
            📍 {placeData.address}
          </p>
        )}
        
        {placeData.work_hours && (
          <p className="place-card__hours">
            🕐 {placeData.work_hours}
          </p>
        )}
        
        {placeData.phone && (
          <p className="place-card__phone">
            📞 {placeData.phone}
          </p>
        )}
        
        <div className="place-card__actions">
          <button 
            className={`btn ${isInRoute ? 'btn--secondary' : 'btn--primary'}`}
            onClick={() => onAddToRoute(placeData)}
            disabled={isInRoute}
          >
            {isInRoute ? '✓ В маршруте' : '+ Добавить в маршрут'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getCardStyle(category) {
  const colors = {
    'restaurant': '#FFE5E5',
    'fuel': '#E5F0FF',
    'supermarket': '#E5FFE5',
    'attraction': '#FFF5E5',
    'park': '#E5FFF5'
  };
  return {
    borderLeft: `4px solid ${colors[category] || '#E0E0E0'}`
  };
}

export default PlaceCard;
