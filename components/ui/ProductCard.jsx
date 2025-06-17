import React from 'react';
import Image from 'next/image'; // Assuming Next.js Image component for optimization

// Basic styling - can be expanded with Tailwind or CSS Modules
const cardStyle = {
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
  maxWidth: '350px', // Or adjust as needed
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
};

const imageStyle = {
  width: '100%',
  height: '200px', // Fixed height, or use aspect ratio
  objectFit: 'cover', // Or 'contain'
  borderRadius: '4px',
  marginBottom: '12px',
};

const ProductCard = ({ product }) => {
  if (!product) {
    return null;
  }

  // Destructure with defaults for safety
  const { name, description, image_url, claims, nutrition_info, weight } = product;

  return (
    <div style={cardStyle}>
      {image_url && (
        <Image
          src={image_url}
          alt={name || 'Product Image'}
          width={350} // Provide appropriate width
          height={200} // Provide appropriate height
          style={imageStyle}
          // layout="responsive" // if you want responsive image sizing
        />
      )}
      <h3>{name || 'Unnamed Product'}</h3>
      {description && <p style={{ fontSize: '0.9em', color: '#555' }}>{description}</p>}

      {weight && <p style={{ fontSize: '0.8em', color: '#777' }}>Weight: {weight}</p>}

      {claims && Array.isArray(claims) && claims.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <h4 style={{ fontSize: '0.85em', marginBottom: '4px' }}>Claims:</h4>
          <ul style={{ fontSize: '0.8em', paddingLeft: '16px' }}>
            {claims.map((claim, index) => (
              <li key={index}>{typeof claim === 'string' ? claim : claim.text}</li>
            ))}
          </ul>
        </div>
      )}

      {nutrition_info && typeof nutrition_info === 'object' && Object.keys(nutrition_info).length > 0 && (
         <div style={{ marginTop: '8px' }}>
            <h4 style={{ fontSize: '0.85em', marginBottom: '4px' }}>Nutrition Highlights:</h4>
            <ul style={{ fontSize: '0.8em', paddingLeft: '16px' }}>
                {/* Example: Displaying a few key nutrition facts. Adjust as needed. */}
                {nutrition_info.calories && <li>Calories: {nutrition_info.calories}</li>}
                {nutrition_info.protein && <li>Protein: {nutrition_info.protein}g</li>}
                {/* Add more nutrition details as desired */}
            </ul>
        </div>
      )}
      {/* Add more fields as needed, e.g., price, link to product page, etc. */}
    </div>
  );
};

export default ProductCard;
