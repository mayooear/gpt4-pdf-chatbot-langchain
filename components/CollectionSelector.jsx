import { collectionsConfig } from '@/utils/client/collectionsConfig';

export default function CollectionSelector({ onCollectionChange, currentCollection }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-end">
      <select
        id="collection"
        value={currentCollection}
        onChange={(e) => onCollectionChange(e.target.value)}
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
