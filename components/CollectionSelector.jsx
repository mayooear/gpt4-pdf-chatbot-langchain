import { collectionsConfig } from '@/utils/client/collectionsConfig';
import { logEvent } from '@/utils/client/analytics';

export default function CollectionSelector({ onCollectionChange, currentCollection }) {
  const handleCollectionChange = (newCollection) => {
    onCollectionChange(newCollection);
    logEvent('change_collection', 'UI', newCollection);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-end">
      <select
        id="collection"
        value={currentCollection}
        onChange={(e) => handleCollectionChange(e.target.value)}
        className="block w-full pl-3 pr-1 py-2 text-base border-gray-300 
        focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md text-right"
      >
        {Object.entries(collectionsConfig).map(([key, value]) => (
          <option key={key} value={key}>{value}</option>
        ))}
      </select>
    </div>
  );
}
