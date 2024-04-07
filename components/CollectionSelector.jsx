export default function CollectionSelector({ onCollectionChange, currentCollection }) {
  return (
    <div className="flex flex-col sm:flex-row items-center">
      <select
        id="collection"
        value={currentCollection}
        onChange={(e) => onCollectionChange(e.target.value)}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 
        focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
      >
        <option value="master_swami">Master and Swamiji Only</option>
        <option value="whole_library">Whole Library</option>
      </select>
    </div>
  );
}