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
        <option value="master_swami">Master and Swami only</option>
        <option value="whole_library">Whole library</option>
      </select>
    </div>
  );
}