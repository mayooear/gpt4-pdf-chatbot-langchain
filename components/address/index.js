import React from 'react';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from 'use-places-autocomplete';
import { useGoogleMapsScript, Libraries } from 'use-google-maps-script';
import { useRouter } from 'next/router';

// Add input styling
const inputStyle = {
  boxSizing: 'border-box',
  border: '1px solid transparent',
  width: '100%',
  height: '32px',
  borderRadius: '3px',
  fontSize: '20px',
  outline: 'none',
  border: '2px solid #6e7ed6',
  padding: '20px 20px',
};

// button styling kind of link material ui buttons
const buttonStyle = {
  backgroundColor: '#3f51b5',
  border: 'none',
  cursor: 'pointer',
  color: 'white',
  fontSize: '18px',
  outline: 'none',
  padding: '10px 20px',
  borderRadius: '3px',
  // fontWeight: 'bold',
  margin: '20px auto',

  // hover
  ':hover': {
    backgroundColor: '#6e7ed6',
  },
};

const listItemStyles = {
  cursor: 'pointer',
  listStyle: 'none',
  padding: '10px 20px',
  borderBottom: '1px solid #e9e9e9',
  borderLeft: '1px solid #e9e9e9',
  borderRight: '1px solid #e9e9e9',
  width: '100%',
};

const libraries = ['places'];

const inputWrapper = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
};

const ReadySearchBox = ({ setShowChat }) => {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      // new zealand, suburb or address componentRestrictions
      componentRestrictions: {
        country: ['nz'],
        // types: ['address'],
        // types: ['(regions)'],
        // types: ['(cities)'],
        // // suburb
        // types: ['(sublocality)'],
      },
    },
    debounce: 300,
  });

  const router = useRouter();

  const [selectedAddress, setSelectedAddress] = React.useState('');

  const handleInput = (e) => {
    // Update the keyword of the input element
    setValue(e.target.value);
  };

  const handleSelect =
    ({ description }) =>
    () => {
      // When user selects a place, we can replace the keyword without request data from API
      // by setting the second parameter to "false"
      setValue(description, false);
      clearSuggestions();

      // Get latitude and longitude via utility functions
      getGeocode({ address: description }).then((results) => {
        const { lat, lng } = getLatLng(results[0]);
        console.log('📍 Coordinates: ', { lat, lng });
        setSelectedAddress(results);
      });
    };

  const renderSuggestions = () =>
    data.map((suggestion) => {
      const {
        place_id,
        structured_formatting: { main_text, secondary_text },
      } = suggestion;

      return (
        <li
          key={place_id}
          onClick={handleSelect(suggestion)}
          style={listItemStyles}
        >
          <strong>{main_text}</strong> <small>{secondary_text}</small>
        </li>
      );
    });

  return (
    <div style={inputWrapper}>
      <input
        value={value}
        onChange={handleInput}
        disabled={!ready}
        placeholder="Enter suburb or address"
        style={inputStyle}
      />
      {/* We can use the "status" to decide whether we should display the dropdown or not */}
      {status === 'OK' && <ul>{renderSuggestions()}</ul>}

      {/* if address selected show button */}
      {!!selectedAddress && (
        <button
          onClick={() => {
            // setShowChat(true);
            // navigate to chat page using next router with data
            const lat = selectedAddress[0].geometry.location.lat().toString();
            const lng = selectedAddress[0].geometry.location.lng().toString();

            router.push({
              pathname: '/chat',
              name: 'chat',
              query: { lat, lng },
            });
          }}
          style={buttonStyle}
        >
          START CHAT
        </button>
      )}
    </div>
  );
};

export function SearchBox({ onSelectAddress, defaultValue, setShowChat }) {
  // NZ address
  const { isLoaded, loadError } = useGoogleMapsScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
    libraries,
  });

  if (!isLoaded) return null;
  if (loadError) return <div>Error loading</div>;

  return (
    <div>
      <ReadySearchBox
        onSelectAddress={onSelectAddress}
        defaultValue={defaultValue}
        setShowChat={setShowChat}
      />
    </div>
  );
}

const AddressWrapperStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
};

const AddressInnerStyle = {
  display: 'inline-block',
  width: '500px',
  margin: '100px auto',
};

const headerStyle = {
  textAlign: 'center',
  fontSize: '30px',
  fontWeight: 'bold',
  margin: '20px auto 40px',
  lineHeight: '1.2',
};

const Address = (props) => {
  const { address, setAddress, setShowChat } = props;

  return (
    <div style={AddressWrapperStyle}>
      <div style={AddressInnerStyle}>
        <h1 style={headerStyle}>
          Enter address to find information about an address or suburb
        </h1>
        <SearchBox
          onSelectAddress={setAddress}
          defaultValue={address}
          setShowChat={setShowChat}
        />
      </div>
    </div>
  );
};

export default Address;
